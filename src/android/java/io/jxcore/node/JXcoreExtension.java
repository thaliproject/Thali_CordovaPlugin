/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.content.Context;
import android.content.pm.PackageManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Log;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothManager;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothUtils;
import org.thaliproject.p2p.btconnectorlib.utils.CommonUtils;

import java.util.ArrayList;
import java.util.Date;

import io.jxcore.node.jxcore.JXcoreCallback;

/**
 * Implements Thali native interface.
 * For the documentation, please see
 * https://github.com/thaliproject/Thali_CordovaPlugin/blob/vNext/thali/NextGeneration/thaliMobileNative.js
 */
public class JXcoreExtension implements SurroundingStateObserver {

    // Common Thali methods and events
    public static final String CALLBACK_VALUE_LISTENING_ON_PORT_NUMBER = "listeningPort";
    public static final String CALLBACK_VALUE_CLIENT_PORT_NUMBER = "clientPort";
    public static final String CALLBACK_VALUE_SERVER_PORT_NUMBER = "serverPort";

    private static final String METHOD_NAME_START_LISTENING_FOR_ADVERTISEMENTS = "startListeningForAdvertisements";
    private static final String METHOD_NAME_STOP_LISTENING_FOR_ADVERTISEMENTS = "stopListeningForAdvertisements";
    private static final String METHOD_NAME_START_UPDATE_ADVERTISING_AND_LISTENING = "startUpdateAdvertisingAndListening";
    private static final String METHOD_NAME_STOP_ADVERTISING_AND_LISTENING = "stopAdvertisingAndListening";
    private static final String METHOD_NAME_CONNECT = "connect";
    private static final String METHOD_NAME_KILL_CONNECTIONS = "killConnections";
    private static final String METHOD_NAME_DID_REGISTER_TO_NATIVE = "didRegisterToNative";
    private static final String METHOD_NAME_MULTICONNECT = "multiConnect";
    private static final String METHOD_NAME_DISCONNECT = "disconnect";
    private static final String EVENT_NAME_PEER_AVAILABILITY_CHANGED = "peerAvailabilityChanged";
    private static final String EVENT_NAME_DISCOVERY_ADVERTISING_STATE_UPDATE = "discoveryAdvertisingStateUpdateNonTCP";
    private static final String EVENT_NAME_NETWORK_CHANGED = "networkChanged";
    private static final String EVENT_NAME_INCOMING_CONNECTION_TO_PORT_NUMBER_FAILED = "incomingConnectionToPortNumberFailed";
    private static final String METHOD_NAME_LOCK_WIFI_MULTICAST = "lockAndroidWifiMulticast";
    private static final String METHOD_NAME_UNLOCK_WIFI_MULTICAST = "unlockAndroidWifiMulticast";
    private static final String METHOD_ARGUMENT_NETWORK_CHANGED = EVENT_NAME_NETWORK_CHANGED;

    private static final String EVENT_VALUE_PEER_ID = "peerIdentifier";
    private static final String EVENT_VALUE_PEER_GENERATION = "generation";
    private static final String EVENT_VALUE_PEER_AVAILABLE = "peerAvailable";
    private static final String EVENT_VALUE_DISCOVERY_ACTIVE = "discoveryActive";
    private static final String EVENT_VALUE_ADVERTISING_ACTIVE = "advertisingActive";
    private static final String EVENT_VALUE_BLUETOOTH_LOW_ENERGY = "bluetoothLowEnergy";
    private static final String EVENT_VALUE_BLUETOOTH = "bluetooth";
    private static final String EVENT_VALUE_WIFI = "wifi";
    private static final String EVENT_VALUE_CELLULAR = "cellular";
    private static final String EVENT_VALUE_BSSID_NAME = "bssidName";
    private static final String EVENT_VALUE_SSID_NAME = "ssidName";
    private static final String EVENT_VALUE_PORT_NUMBER = "portNumber";
    // Android specific methods and events
    private static final String METHOD_NAME_IS_BLE_MULTIPLE_ADVERTISEMENT_SUPPORTED = "isBleMultipleAdvertisementSupported";
    private static final String METHOD_NAME_GET_BLUETOOTH_ADDRESS = "getBluetoothAddress";
    private static final String METHOD_NAME_GET_BLUETOOTH_NAME = "getBluetoothName";
    private static final String METHOD_NAME_KILL_OUTGOING_CONNECTIONS = "killOutgoingConnections";
    private static final String METHOD_NAME_GET_OS_VERSION = "getOSVersion";
    private static final String METHOD_NAME_RECONNECT_WIFI_AP = "reconnectWifiAp";
    private static final String METHOD_NAME_SHOW_TOAST = "showToast";

    private static final String TAG = JXcoreExtension.class.getName();
    private static final long INCOMING_CONNECTION_FAILED_NOTIFICATION_MIN_INTERVAL_IN_MILLISECONDS = 100;

    private static final String ERROR_PLATFORM_DOES_NOT_SUPPORT_MULTICONNECT = "Platform does not support multiConnect";
    private static final String ERROR_NOT_MULTICONNECT_PLATFORM = "Not multiConnect platform";

    private static ConnectionHelper mConnectionHelper = null;
    private static WifiLocker wifiLocker = new WifiLocker();
    private static long mLastTimeIncomingConnectionFailedNotificationWasFired = 0;
    private static boolean mNetworkChangedRegistered = false;

    private static class Holder {
        private static final JXcoreExtension INSTANCE = new JXcoreExtension();
    }

    private JXcoreExtension() {
    }

    static SurroundingStateObserver getInstance() {
        return Holder.INSTANCE;
    }

    public static void LoadExtensions() {
        if (mConnectionHelper != null) {
            Log.e(TAG, "LoadExtensions: A connection helper instance already exists - this indicates that this method was called twice - disposing of the previous instance");
            mConnectionHelper.dispose();
            mConnectionHelper = null;
        }

        mConnectionHelper = new ConnectionHelper(getInstance());
        mConnectionHelper.listenToConnectivityEvents();

        final LifeCycleMonitor lifeCycleMonitor = new LifeCycleMonitor(new LifeCycleMonitor.LifeCycleMonitorListener() {
            @Override
            public void onActivityLifeCycleEvent(LifeCycleMonitor.ActivityLifeCycleEvent activityLifeCycleEvent) {
                Log.d(TAG, "onActivityLifeCycleEvent: " + activityLifeCycleEvent);

                switch (activityLifeCycleEvent) {
                    case DESTROYED:
                        mConnectionHelper.dispose();
                    default:
                        // No need to do anything
                }
            }
        });

        lifeCycleMonitor.start();
        /*
            This is the line where we are dynamically sticking execution of UT during build, so if you are
            editing this line, please check updateJXCoreExtensionWithUTMethod in androidBeforeCompile.js.
        */

        jxcore.RegisterMethod(METHOD_NAME_START_LISTENING_FOR_ADVERTISEMENTS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                Log.d(TAG, METHOD_NAME_START_LISTENING_FOR_ADVERTISEMENTS);
                startConnectionHelper(ConnectionHelper.NO_PORT_NUMBER, false, callbackId);
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_STOP_LISTENING_FOR_ADVERTISEMENTS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, final String callbackId) {
                Log.d(TAG, METHOD_NAME_STOP_LISTENING_FOR_ADVERTISEMENTS);

                mConnectionHelper.stop(true, new JXcoreThaliCallback() {
                    @Override
                    protected void onStartStopCallback(String errorMessage) {
                        ArrayList<Object> args = new ArrayList<Object>();
                        args.add(errorMessage);
                        jxcore.CallJSMethod(callbackId, args.toArray());
                    }
                });
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_START_UPDATE_ADVERTISING_AND_LISTENING, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                Log.d(TAG, METHOD_NAME_START_UPDATE_ADVERTISING_AND_LISTENING);
                ArrayList<Object> args = new ArrayList<Object>();
                String errorString = null;

                if (params != null && params.size() > 0) {
                    Object parameterObject = params.get(0);

                    if (parameterObject instanceof Integer && ((Integer) parameterObject > 0)) {
                        startConnectionHelper((Integer) parameterObject, true, callbackId);
                    } else {
                        errorString = "Required parameter, {number} portNumber, is invalid - must be a positive integer";
                    }
                } else {
                    errorString = "Required parameter, {number} portNumber, missing";
                }

                if (errorString != null) {
                    // Failed straight away
                    args.add(errorString);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                }
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_STOP_ADVERTISING_AND_LISTENING, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, final String callbackId) {
                Log.d(TAG, METHOD_NAME_STOP_ADVERTISING_AND_LISTENING);

                mConnectionHelper.stop(false, new JXcoreThaliCallback() {
                    @Override
                    protected void onStartStopCallback(String errorMessage) {
                        ArrayList<Object> args = new ArrayList<Object>();
                        args.add(null);
                        jxcore.CallJSMethod(callbackId, args.toArray());
                    }
                });
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_CONNECT, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, final String callbackId) {
                if (params.size() == 0) {
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add("Required parameter, {string} peerIdentifier, missing");
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                if (mConnectionHelper.getConnectivityMonitor().isBleMultipleAdvertisementSupported() ==
                    BluetoothManager.FeatureSupportedStatus.NOT_SUPPORTED) {
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add("No Native Non-TCP Support");
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                if (mConnectionHelper.getDiscoveryManager().getState() ==
                    DiscoveryManager.DiscoveryManagerState.WAITING_FOR_SERVICES_TO_BE_ENABLED) {
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add("Radio Turned Off");
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                final DiscoveryManager discoveryManager = mConnectionHelper.getDiscoveryManager();
                final DiscoveryManager.DiscoveryManagerState discoveryManagerState = discoveryManager.getState();

                if (discoveryManagerState != DiscoveryManager.DiscoveryManagerState.RUNNING_BLE) {
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add("startListeningForAdvertisements is not active");
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                String peerId = params.get(0).toString();
                String bluetoothMacAddress = null;

                if (peerId != null) {
                    bluetoothMacAddress = peerId;
                }

                if (!BluetoothUtils.isValidBluetoothMacAddress(bluetoothMacAddress)) {
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add("Illegal peerID");
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                Log.d(TAG, METHOD_NAME_CONNECT + ": " + bluetoothMacAddress);

                if (mConnectionHelper.getConnectionModel().getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress) != null) {
                    Log.e(TAG, METHOD_NAME_CONNECT + ": Already connecting");
                    ArrayList<Object> args = new ArrayList<Object>();

                    // In case you want to check, if we are already connected (instead of connecting), do:
                    // mConnectionHelper.getConnectionModel().hasOutgoingConnection()

                    args.add("Already connect(ing/ed)");
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                if (mConnectionHelper.hasMaximumNumberOfConnections()) {
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add("Max connections reached");
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                final String errorMessage =
                    mConnectionHelper.connect(bluetoothMacAddress, new JXcoreThaliCallback() {
                        @Override
                        public void onConnectCallback(
                            String errorMessage,
                            ListenerOrIncomingConnection listenerOrIncomingConnection) {
                            ArrayList<Object> args = new ArrayList<Object>();
                            args.add(errorMessage);

                            if (errorMessage == null) {
                                if (listenerOrIncomingConnection != null) {
                                    args.add(listenerOrIncomingConnection.toString());
                                } else {
                                    throw new NullPointerException(
                                        "ListenerOrIncomingConnection is null even though there is no error message");
                                }
                            }

                            jxcore.CallJSMethod(callbackId, args.toArray());
                        }
                    });

                if (errorMessage != null) {
                    // Failed to start connecting
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add(errorMessage);
                    args.add(null);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                }
            }
        });

        /**
         * Not supported on Android.
         */
        jxcore.RegisterMethod(METHOD_NAME_KILL_CONNECTIONS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                args.add("Not Supported");
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_DID_REGISTER_TO_NATIVE, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                String errorString = null;

                if (params != null && params.size() > 0) {
                    Object parameterObject = params.get(0);

                    if (parameterObject instanceof String
                        && CommonUtils.isNonEmptyString((String) parameterObject)) {
                        String methodName = (String) parameterObject;

                        if (methodName.equals(METHOD_ARGUMENT_NETWORK_CHANGED)) {
                            mNetworkChangedRegistered = true;
                            mConnectionHelper.getConnectivityMonitor().updateConnectivityInfo(true); // Will call notifyNetworkChanged
                        } else {
                            errorString = "Unrecognized method name: " + methodName;
                        }
                    } else {
                        errorString = "Required parameter, {string} methodName, is invalid - must be a non-null and non-empty string";
                    }
                } else {
                    errorString = "Required parameter, {string} methodName, missing";
                }

                args.add(errorString);
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_MULTICONNECT, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();

                args.add(ERROR_PLATFORM_DOES_NOT_SUPPORT_MULTICONNECT);
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_DISCONNECT, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();

                args.add(ERROR_NOT_MULTICONNECT_PLATFORM);
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });


        /**
         * Method for checking whether or not the device supports Bluetooth LE multi advertisement.
         *
         * When successful, the method will return two arguments: The first will have null value and
         * the second will contain a string value:
         *
         *  - "Not resolved" if not resolved (can happen when Bluetooth is disabled)
         *  - "Not supported" if not supported
         *  - "Supported" if supported
         *
         * In case of an error the first argument will contain an error message followed by a null
         * argument. More specifically the error message will be a string starting with
         * "Unrecognized status: " followed by the unrecognized status.
         */
        jxcore.RegisterMethod(METHOD_NAME_IS_BLE_MULTIPLE_ADVERTISEMENT_SUPPORTED, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                BluetoothManager bluetoothManager = mConnectionHelper.getDiscoveryManager().getBluetoothManager();
                BluetoothManager.FeatureSupportedStatus featureSupportedStatus = bluetoothManager.isBleMultipleAdvertisementSupported();
                Log.v(TAG, METHOD_NAME_IS_BLE_MULTIPLE_ADVERTISEMENT_SUPPORTED + ": " + featureSupportedStatus);

                switch (featureSupportedStatus) {
                    case NOT_RESOLVED:
                        args.add(null);
                        args.add("Not resolved");
                        break;
                    case NOT_SUPPORTED:
                        args.add(null);
                        args.add("Not supported");
                        break;
                    case SUPPORTED:
                        args.add(null);
                        args.add("Supported");
                        break;
                    default:
                        String errorMessage = "Unrecognized status: " + featureSupportedStatus;
                        Log.e(TAG, METHOD_NAME_IS_BLE_MULTIPLE_ADVERTISEMENT_SUPPORTED
                            + ": " + errorMessage);
                        args.add(errorMessage);
                        args.add(null);
                        break;
                }

                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_GET_BLUETOOTH_ADDRESS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                String bluetoothMacAddress = mConnectionHelper.getDiscoveryManager().getBluetoothMacAddress();

                if (bluetoothMacAddress == null || bluetoothMacAddress.length() == 0) {
                    args.add("Bluetooth MAC address unknown");
                } else {
                    args.add(null);
                    args.add(bluetoothMacAddress);
                }

                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_GET_BLUETOOTH_NAME, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                String bluetoothNameString = mConnectionHelper.getBluetoothName();

                if (bluetoothNameString == null) {
                    args.add("Unable to get the Bluetooth name");
                } else {
                    args.add(null);
                    args.add(bluetoothNameString);
                }

                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_KILL_OUTGOING_CONNECTIONS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                mConnectionHelper.killConnections(false);
                ArrayList<Object> args = new ArrayList<Object>();
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_GET_OS_VERSION, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                args.add(Build.VERSION.RELEASE);
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_RECONNECT_WIFI_AP, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                WifiManager wifiManager =
                    (WifiManager) jxcore.activity.getBaseContext().getSystemService(Context.WIFI_SERVICE);

                if (wifiManager.reconnect()) {
                    wifiManager.disconnect();

                    if (!wifiManager.reconnect()) {
                        args.add("WifiManager.reconnect returned false");
                    }
                }

                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_SHOW_TOAST, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();

                if (params.size() == 0) {
                    args.add("Required parameter (toast message) missing");
                } else {
                    String message = params.get(0).toString();
                    int toastDuration = Toast.LENGTH_SHORT;

                    if (params.size() == 2 && ((Boolean) params.get(1))) {
                        toastDuration = Toast.LENGTH_LONG;
                    }

                    Toast.makeText(jxcore.activity.getApplicationContext(), message, toastDuration).show();
                    args.add(null);
                }

                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_LOCK_WIFI_MULTICAST, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                WifiManager wifiManager = (WifiManager) jxcore.activity.getSystemService(Context.WIFI_SERVICE);
                String result = wifiLocker.acquireLock(wifiManager);
                args.add(result);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_UNLOCK_WIFI_MULTICAST, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                wifiLocker.releaseLock();
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });
    }


    public void notifyPeerAvailabilityChanged(PeerProperties peerProperties, boolean isAvailable) {
        JSONObject jsonObject = new JSONObject();
        boolean jsonObjectCreated = false;

        try {
            jsonObject.put(EVENT_VALUE_PEER_ID, peerProperties.getId());
            Integer gen = peerProperties.getExtraInformation();
            if (!isAvailable) {
                gen = (peerProperties.getExtraInformation() == 0) ? null : peerProperties.getExtraInformation();
            }
            jsonObject.put(EVENT_VALUE_PEER_GENERATION, gen);
            jsonObject.put(EVENT_VALUE_PEER_AVAILABLE, isAvailable);
            jsonObjectCreated = true;
        } catch (JSONException e) {
            Log.e(TAG, "notifyPeerAvailabilityChanged: Failed to populate the JSON object: " + e.getMessage(), e);
        }

        if (jsonObjectCreated) {
            JSONArray jsonArray = new JSONArray();
            jsonArray.put(jsonObject);
            final String jsonArrayAsString = jsonArray.toString();

            jxcore.activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    jxcore.CallJSMethod(EVENT_NAME_PEER_AVAILABILITY_CHANGED, jsonArrayAsString);
                }
            });
        }
    }

    public void notifyDiscoveryAdvertisingStateUpdateNonTcp(boolean isDiscoveryActive, boolean isAdvertisingActive) {
        JSONObject jsonObject = new JSONObject();
        boolean jsonObjectCreated = false;

        try {
            jsonObject.put(EVENT_VALUE_DISCOVERY_ACTIVE, isDiscoveryActive);
            jsonObject.put(EVENT_VALUE_ADVERTISING_ACTIVE, isAdvertisingActive);
            jsonObjectCreated = true;
        } catch (JSONException e) {
            Log.e(TAG, "notifyDiscoveryAdvertisingStateUpdateNonTcp: Failed to populate the JSON object: " + e.getMessage(), e);
        }

        if (jsonObjectCreated) {
            final String jsonObjectAsString = jsonObject.toString();

            try {
                jxcore.activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        jxcore.CallJSMethod(EVENT_NAME_DISCOVERY_ADVERTISING_STATE_UPDATE, jsonObjectAsString);
                    }
                });
            } catch (NullPointerException e) {
                Log.e(TAG, "notifyDiscoveryAdvertisingStateUpdateNonTcp: Failed to notify: " + e.getMessage(), e);
            }
        }
    }

    /**
     * @param isBluetoothEnabled If true, Bluetooth is enabled. False otherwise.
     * @param isWifiEnabled      If true, Wi-Fi is enabled. False otherwise.
     * @param bssidName          If null this value indicates that either wifiRadioOn is not 'on' or
     *                           that the Wi-Fi isn't currently connected to an access point.
     *                           If non-null then this is the BSSID of the access point that Wi-Fi
     *                           is connected to.
     */
    public synchronized void notifyNetworkChanged(boolean isBluetoothEnabled, boolean isWifiEnabled,
                                                  String bssidName, String ssidName) {
        if (!mNetworkChangedRegistered) {
            Log.d(TAG, "notifyNetworkChanged: Not registered for event \""
                + EVENT_NAME_NETWORK_CHANGED + "\" and will not notify, in JS call method \""
                + METHOD_NAME_DID_REGISTER_TO_NATIVE + "\" with argument \""
                + METHOD_ARGUMENT_NETWORK_CHANGED + "\" to register");
            return;
        }

        RadioState bluetoothLowEnergyRadioState;
        RadioState bluetoothRadioState;
        RadioState wifiRadioState;
        RadioState cellularRadioState = RadioState.DO_NOT_CARE;

        final ConnectivityMonitor connectivityMonitor = mConnectionHelper.getConnectivityMonitor();

        if (connectivityMonitor.isBleMultipleAdvertisementSupported() !=
            BluetoothManager.FeatureSupportedStatus.NOT_SUPPORTED) {
            if (isBluetoothEnabled) {
                bluetoothLowEnergyRadioState = RadioState.ON;
            } else {
                bluetoothLowEnergyRadioState = RadioState.OFF;
            }
        } else {
            bluetoothLowEnergyRadioState = RadioState.NOT_HERE;
        }

        if (connectivityMonitor.isBluetoothSupported()) {
            if (isBluetoothEnabled) {
                bluetoothRadioState = RadioState.ON;
            } else {
                bluetoothRadioState = RadioState.OFF;
            }
        } else {
            bluetoothRadioState = RadioState.NOT_HERE;
        }

        if (connectivityMonitor.isWifiDirectSupported()) {
            if (isWifiEnabled) {
                wifiRadioState = RadioState.ON;
            } else {
                wifiRadioState = RadioState.OFF;
            }
        } else {
            wifiRadioState = RadioState.NOT_HERE;
        }

        Log.d(TAG, "notifyNetworkChanged: BLE: " + bluetoothLowEnergyRadioState
            + ", Bluetooth: " + bluetoothRadioState
            + ", Wi-Fi: " + wifiRadioState
            + ", cellular: " + cellularRadioState
            + ", BSSID name: " + bssidName
            + ", SSID name: " + ssidName);

        JSONObject jsonObject = new JSONObject();
        boolean jsonObjectCreated = false;

        try {
            jsonObject.put(EVENT_VALUE_BLUETOOTH_LOW_ENERGY, radioStateEnumValueToString(bluetoothLowEnergyRadioState));
            jsonObject.put(EVENT_VALUE_BLUETOOTH, radioStateEnumValueToString(bluetoothRadioState));
            jsonObject.put(EVENT_VALUE_WIFI, radioStateEnumValueToString(wifiRadioState));
            jsonObject.put(EVENT_VALUE_CELLULAR, radioStateEnumValueToString(cellularRadioState));
            jsonObject.put(EVENT_VALUE_BSSID_NAME, bssidName);
            jsonObject.put(EVENT_VALUE_SSID_NAME, ssidName);
            jsonObjectCreated = true;
        } catch (JSONException e) {
            Log.e(TAG, "notifyNetworkChanged: Failed to populate the JSON object: " + e.getMessage(), e);
        }

        if (jsonObjectCreated) {
            final String jsonObjectAsString = jsonObject.toString();

            jxcore.activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    jxcore.CallJSMethod(EVENT_NAME_NETWORK_CHANGED, jsonObjectAsString);
                }
            });
        }
    }

    /**
     * This event is guaranteed to be not sent more often than every 100 ms.
     *
     * @param portNumber The 127.0.0.1 port that the TCP/IP bridge tried to connect to.
     */
    public void notifyIncomingConnectionToPortNumberFailed(int portNumber) {
        long currentTime = new Date().getTime();

        if (currentTime > mLastTimeIncomingConnectionFailedNotificationWasFired
            + INCOMING_CONNECTION_FAILED_NOTIFICATION_MIN_INTERVAL_IN_MILLISECONDS) {
            JSONObject jsonObject = new JSONObject();
            boolean jsonObjectCreated = false;

            try {
                jsonObject.put(EVENT_VALUE_PORT_NUMBER, portNumber);
                jsonObjectCreated = true;
            } catch (JSONException e) {
                Log.e(TAG, "notifyIncomingConnectionToPortNumberFailed: Failed to populate the JSON object: " + e.getMessage(), e);
            }

            if (jsonObjectCreated) {
                mLastTimeIncomingConnectionFailedNotificationWasFired = currentTime;
                final String jsonObjectAsString = jsonObject.toString();

                jxcore.activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        jxcore.CallJSMethod(EVENT_NAME_INCOMING_CONNECTION_TO_PORT_NUMBER_FAILED, jsonObjectAsString);
                    }
                });
            }
        }
    }

    /**
     * Tries to starts the connection helper.
     *
     * @param serverPortNumber    The port on 127.0.0.1 that any incoming connections over the native
     *                            non-TCP/IP transport should be bridged to.
     * @param startAdvertisements If true, will start advertising our presence and scanning for other peers.
     *                            If false, will only scan for other peers.
     * @param callbackId          The JXcore callback ID.
     */
    private static void startConnectionHelper(
        int serverPortNumber, boolean startAdvertisements, final String callbackId) {
        final ArrayList<Object> args = new ArrayList<Object>();
        String errorString = null;

        if (mConnectionHelper.getConnectivityMonitor().isBleMultipleAdvertisementSupported() !=
            BluetoothManager.FeatureSupportedStatus.NOT_SUPPORTED) {
            boolean succeededToStartOrWasAlreadyRunning =
                mConnectionHelper.start(serverPortNumber, startAdvertisements, new JXcoreThaliCallback() {
                    @Override
                    protected void onStartStopCallback(final String errorMessage) {
                        args.add(errorMessage);
                        jxcore.CallJSMethod(callbackId, args.toArray());
                    }
                });

            if (succeededToStartOrWasAlreadyRunning) {
                final DiscoveryManager discoveryManager = mConnectionHelper.getDiscoveryManager();

                if (discoveryManager.getState() ==
                    DiscoveryManager.DiscoveryManagerState.WAITING_FOR_SERVICES_TO_BE_ENABLED) {
                    errorString = "Radio Turned Off";

                    // If/when radios are turned on, the discovery is started automatically
                    // unless stop is called
                }
            } else {
                errorString = "Unspecified Error with Radio infrastructure";
            }
        } else {
            errorString = "No Native Non-TCP Support";
        }

        if (errorString != null) {
            // Failed straight away
            args.add(errorString);
            jxcore.CallJSMethod(callbackId, args.toArray());
        }
    }

    /**
     * Returns a string value matching the given RadioState enum value.
     *
     * @param radioState The RadioState enum value.
     * @return A string matching the given RadioState enum value.
     */
    private static String radioStateEnumValueToString(RadioState radioState) {
        switch (radioState) {
            case ON:
                return "on";
            case OFF:
                return "off";
            case UNAVAILABLE:
                return "unavailable";
            case NOT_HERE:
                return "notHere";
            case DO_NOT_CARE:
                return "doNotCare";
        }

        return null;
    }

    public enum RadioState {
        ON, // The radio is on and available for use.
        OFF, // The radio exists on the device but is turned off.
        UNAVAILABLE, // The radio exists on the device and is on but for some reason the system won't let us use it.
        NOT_HERE, // We depend on this radio type for this platform type but it doesn't appear to exist on this device.
        DO_NOT_CARE // Thali doesn't use this radio type on this platform and so makes no effort to determine its state.
    }
}
