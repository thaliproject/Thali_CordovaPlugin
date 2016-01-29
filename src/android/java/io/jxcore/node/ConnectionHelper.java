/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothSocket;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.CountDownTimer;
import android.os.Handler;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager.ConnectionManagerState;
import org.thaliproject.p2p.btconnectorlib.ConnectionManagerSettings;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManagerSettings;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothUtils;

import java.io.IOException;
import java.util.HashMap;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Wraps the Android connector library functionality and provides an interface for JXcore layer
 * (with the help of JXcoreExtensions class).
 */
public class ConnectionHelper
        implements
            ConnectionManager.ConnectionManagerListener,
            DiscoveryManager.DiscoveryManagerListener,
            PeerAndConnectionModel.Listener {
    /**
     * A listener interface for relaying connection status change events to Node layer.
     * This interface only applies to outgoing connection attempts (i.e. when you call
     * ConnectionHelper.connect()
     */
    public interface JxCoreExtensionListener {
        void onConnectionStatusChanged(String message, int port);
    }

    private static final String TAG = ConnectionHelper.class.getName();
    private static final String SERVICE_TYPE = "Cordovap2p._tcp";
    private static final String SERVICE_UUID_AS_STRING = "fa87c0d0-afac-11de-8a39-0800200c9a66";
    private static final String BLE_SERVICE_UUID_AS_STRING = "b6a44ad1-d319-4b3a-815d-8b805a47fb51";
    private static final String BLUETOOTH_NAME = "Thali_Bluetooth";
    private static final UUID SERVICE_UUID = UUID.fromString(SERVICE_UUID_AS_STRING);
    private static final UUID BLE_SERVICE_UUID = UUID.fromString(BLE_SERVICE_UUID_AS_STRING);
    private static final long POWER_UP_BLE_DISCOVERY_DELAY_IN_MILLISECONDS = 15000;
    private static final int MAXIMUM_NUMBER_OF_CONNECTIONS = 30; // TODO: Determine a way to figure out a proper value here
    private static final int PORT_NUMBER_IN_ERROR_CASES = -1;

    private final Context mContext;
    private final Thread.UncaughtExceptionHandler mThreadUncaughtExceptionHandler;
    private final PeerAndConnectionModel mPeerAndConnectionModel;
    private final HashMap<String, JxCoreExtensionListener> mOutgoingConnectionListeners;
    private ConnectionManager mConnectionManager = null;
    private DiscoveryManager mDiscoveryManager = null;
    private DiscoveryManagerSettings mDiscoveryManagerSettings = null;
    private CountDownTimer mPowerUpBleDiscoveryTimer = null;
    private int mServerPort = 0;

    /**
     * Constructor.
     */
    public ConnectionHelper() {
        mContext = jxcore.activity.getBaseContext();

        mThreadUncaughtExceptionHandler = new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, final Throwable ex) {
                final Throwable tempException = ex;

                new Handler(jxcore.activity.getMainLooper()).post(new Runnable() {
                    @Override
                    public void run() {
                        Log.e(TAG, "Unhandled exception: " + ex.getMessage(), ex);
                        throw new RuntimeException(tempException);
                    }
                });
            }
        };

        mPeerAndConnectionModel = new PeerAndConnectionModel(this);
        mOutgoingConnectionListeners = new HashMap<String, JxCoreExtensionListener>();
    }

    /**
     * Tries to start the connection manager and peer discovery.
     * @param peerName Our peer name.
     * @param port The local server port to use.
     * @return True, if started successfully. False otherwise.
     */
    public synchronized boolean start(String peerName, int port) {
        stop();
        mServerPort = port;

        mConnectionManager = new ConnectionManager(mContext, this, SERVICE_UUID, BLUETOOTH_NAME);
        mDiscoveryManager = new DiscoveryManager(mContext, this, BLE_SERVICE_UUID, SERVICE_TYPE);
        mDiscoveryManagerSettings = DiscoveryManagerSettings.getInstance(mContext);

        if (mDiscoveryManagerSettings.setDiscoveryMode(DiscoveryManager.DiscoveryMode.BLE_AND_WIFI)) {
            mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED);
            mDiscoveryManagerSettings.setScanMode(ScanSettings.SCAN_MODE_BALANCED);
        } else {
            mDiscoveryManagerSettings.setDiscoveryMode(DiscoveryManager.DiscoveryMode.WIFI);
        }

        boolean connectionManagerStarted = mConnectionManager.start(peerName);
        boolean discoveryManagerStarted = false;

        if (connectionManagerStarted) {
            Log.i(TAG, "start: Using peer discovery mode: " + mDiscoveryManagerSettings.getDiscoveryMode());
            discoveryManagerStarted = mDiscoveryManager.start(peerName);

            if (discoveryManagerStarted) {
                Log.i(TAG, "start: OK");
            }
        }

        if (!connectionManagerStarted || !discoveryManagerStarted) {
            Log.e(TAG, "start: Failed: Connection manager started: " + connectionManagerStarted
                    + ", Discovery manager started: " + discoveryManagerStarted);
            stop();
        }

        return (connectionManagerStarted && discoveryManagerStarted);
    }

    /**
     * Stops all activities and disconnects all active connections.
     */
    public synchronized void stop() {
        if (mConnectionManager != null) {
            Log.i(TAG, "stop");
            mConnectionManager.stop();
            mConnectionManager = null;
        }

        if (mDiscoveryManager != null) {
            mDiscoveryManager.stop();
            mDiscoveryManager = null;
        }

        killAllConnections();
    }

    /**
     * Kills all connections.
     * @return The number of incoming connections killed.
     */
    public synchronized int killAllConnections() {
        mPeerAndConnectionModel.closeAndRemoveAllOutgoingConnections();
        mOutgoingConnectionListeners.clear();
        return mPeerAndConnectionModel.closeAndRemoveAllIncomingConnections();
    }

    public boolean isRunning() {
        return (mConnectionManager != null && mDiscoveryManager != null);
    }

    /**
     * @return True, if BLE advertising is supported. False otherwise.
     */
    public boolean isBleMultipleAdvertisementSupported() {
        boolean isSupported = false;

        if (mDiscoveryManager != null) {
            isSupported = mDiscoveryManager.isBleMultipleAdvertisementSupported();
        } else {
            DiscoveryManager discoveryManager = new DiscoveryManager(mContext, this, BLE_SERVICE_UUID, SERVICE_TYPE);
            isSupported = discoveryManager.isBleMultipleAdvertisementSupported();
        }

        return isSupported;
    }

    /**
     * Disconnects the outgoing connection with the given peer ID.
     * @param peerId The ID of the peer to disconnect.
     * @return True, if the peer was found and disconnected.
     */
    public synchronized boolean disconnectOutgoingConnection(final String peerId) {
        Log.d(TAG, "disconnectOutgoingConnection: Trying to close connection to peer with ID " + peerId);
        boolean success = mPeerAndConnectionModel.closeAndRemoveOutgoingConnectionThread(peerId, false);

        if (success) {
            Log.i(TAG, "disconnectOutgoingConnection: Successfully disconnected (peer ID: " + peerId);
        } else {
            Log.w(TAG, "disconnectOutgoingConnection: Failed to disconnect (peer ID: " + peerId
                    + "), either no such connection or failed to close the connection");
        }

        return success;
    }

    /**
     * @return Our Bluetooth MAC address or an empty string, if not resolved.
     */
    public String getBluetoothMacAddress() {
        String bluetoothMacAddress = null;

        if (mDiscoveryManager != null) {
            bluetoothMacAddress = mDiscoveryManager.getBluetoothMacAddress();
        } else {
            DiscoveryManager discoveryManager = new DiscoveryManager(mContext, this, BLE_SERVICE_UUID, SERVICE_TYPE);
            bluetoothMacAddress = discoveryManager.getBluetoothMacAddress();
        }

        if (BluetoothUtils.isBluetoothMacAddressUnknown(bluetoothMacAddress)) {
            bluetoothMacAddress = "";
        }

        return bluetoothMacAddress;
    }

    /**
     * @return Our Bluetooth friendly name or null, if Bluetooth adapter
     * is not resolved or an error occurs while retrieving the name.
     */
    public String getBluetoothName() {
        BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        if (bluetoothAdapter != null) {
            return bluetoothAdapter.getName();
        }

        return null;
    }

    /**
     * Starts the connection process to a peer with the given ID.
     * @param peerIdToConnectTo The ID of the peer to connect to.
     * @param listener The listener.
     */
    public synchronized void connect(final String peerIdToConnectTo, JxCoreExtensionListener listener) {
        Log.i(TAG, "connect: Trying to connect to peer with ID " + peerIdToConnectTo);

        if (listener == null) {
            Log.e(TAG, "connect: Listener is null");
            throw new NullPointerException("Listener is null");
        }

        if (isRunning()) {
            if (!mPeerAndConnectionModel.hasOutgoingConnection(peerIdToConnectTo)) {
                if (mPeerAndConnectionModel.hasIncomingConnection(peerIdToConnectTo)) {
                    Log.i(TAG, "connect: We already have an incoming connection to peer with ID "
                            + peerIdToConnectTo + ", but will connect anyway...");
                }

                if (mPeerAndConnectionModel.getNumberOfCurrentOutgoingConnections() < MAXIMUM_NUMBER_OF_CONNECTIONS) {
                    PeerProperties selectedDevice = mPeerAndConnectionModel.findDiscoveredPeer(peerIdToConnectTo);

                    if (selectedDevice == null) {
                        Log.w(TAG, "connect: The peer to connect to is not amongst the discovered peers, but trying anyway...");
                        selectedDevice = new PeerProperties(
                                peerIdToConnectTo, peerIdToConnectTo, peerIdToConnectTo, "", "", "");
                    }

                    if (BluetoothAdapter.checkBluetoothAddress(selectedDevice.getBluetoothAddress())) {
                        if (mConnectionManager.connect(selectedDevice)) {
                            Log.i(TAG, "connect: Connection process successfully started (peer ID: " + peerIdToConnectTo + ")");
                            mOutgoingConnectionListeners.put(peerIdToConnectTo, listener);
                        } else {
                            Log.e(TAG, "connect: Failed to start connecting");
                            listener.onConnectionStatusChanged("Failed to start connecting", PORT_NUMBER_IN_ERROR_CASES);
                        }
                    } else {
                        Log.e(TAG, "connect: Invalid Bluetooth address: " + selectedDevice.getBluetoothAddress());
                        listener.onConnectionStatusChanged(
                                "Invalid Bluetooth address: " + selectedDevice.getBluetoothAddress(), PORT_NUMBER_IN_ERROR_CASES);
                    }
                } else {
                    Log.e(TAG, "connect: Maximum number of peer connections ("
                            + mPeerAndConnectionModel.getNumberOfCurrentOutgoingConnections()
                            + ") reached, please try again after disconnecting a peer");
                    listener.onConnectionStatusChanged("Maximum number of peer connections ("
                            + mPeerAndConnectionModel.getNumberOfCurrentOutgoingConnections()
                            + ") reached, please try again after disconnecting a peer", PORT_NUMBER_IN_ERROR_CASES);
                }
            } else {
                Log.w(TAG, "connect: We already have an outgoing connection to peer with ID "
                        + peerIdToConnectTo + ", aborting...");

            }
        } else {
            Log.e(TAG, "connect: Not running, please call start() first");
            listener.onConnectionStatusChanged("Not running, please call start() first", PORT_NUMBER_IN_ERROR_CASES);
        }
    }

    /**
     * Toggles between the system decided and the default alternative insecure RFCOMM port number.
     */
    public void toggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber() {
        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance(mContext);

        if (settings.getInsecureRfcommSocketPortNumber() ==
                ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT) {
            settings.setInsecureRfcommSocketPortNumber(
                    ConnectionManagerSettings.DEFAULT_ALTERNATIVE_INSECURE_RFCOMM_SOCKET_PORT);
        } else {
            settings.setInsecureRfcommSocketPortNumber(
                    ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT);
        }
    }

    /**
     * Does nothing but logs the new state.
     * @param connectionManagerState The new state.
     */
    @Override
    public void onConnectionManagerStateChanged(ConnectionManagerState connectionManagerState) {
        Log.i(TAG, "onConnectionManagerStateChanged: " + connectionManagerState.toString());
    }

    /**
     * Takes ownership of the given Bluetooth socket, initializes the connection and adds it to the
     * list of incoming/outgoing connections.
     * @param bluetoothSocket The Bluetooth socket.
     * @param isIncoming True, if the connection is incoming. False, if it is outgoing.
     * @param peerProperties The peer properties.
     */
    @Override
    public void onConnected(BluetoothSocket bluetoothSocket, boolean isIncoming, PeerProperties peerProperties) {
        Log.i(TAG, "onConnected: " + (isIncoming ? "Incoming" : "Outgoing")
                + " connection to peer " + peerProperties.toString());

        if (bluetoothSocket == null) {
            Log.e(TAG, "onConnected: Bluetooth socket is null");
            throw new RuntimeException("onConnected: Bluetooth socket is null");
        }

        if (mPeerAndConnectionModel.hasConnection(peerProperties.getId())) {
            Log.w(TAG, "onConnected: Already connected with peer " + peerProperties.toString() + ", continuing anyway...");
        }

        // Add the peer to the list, if was not discovered before
        if (mPeerAndConnectionModel.modifyListOfDiscoveredPeers(peerProperties, true)) {
            notifyPeerAvailability(peerProperties, true);
        }

        final ConnectionHelper thisInstance = this;

        if (isIncoming) {
            IncomingSocketThread newIncomingSocketThread = null;

            try {
                newIncomingSocketThread = new IncomingSocketThread(bluetoothSocket, new ConnectionStatusListener() {
                    @Override
                    public void onDataTransferred(int numberOfBytes) {
                        new Handler(jxcore.activity.getMainLooper()).post(new Runnable() {
                            @Override
                            public void run() {
                                thisInstance.lowerBleDiscoveryPowerAndStartResetTimer();
                            }
                        });
                    }

                    @Override
                    public void onDisconnected(SocketThreadBase who, String errorMessage) {
                        Log.w(TAG, "onDisconnected: Incoming connection, peer "
                                + who.getPeerProperties().toString()
                                + " disconnected: " + errorMessage);
                        final long threadId = who.getId();

                        new Handler(jxcore.activity.getMainLooper()).post(new Runnable() {
                            @Override
                            public void run() {
                                thisInstance.mPeerAndConnectionModel
                                    .closeAndRemoveIncomingConnectionThread(threadId);
                            }
                        });
                    }
                });
            } catch (IOException e) {
                Log.e(TAG, "onConnected: Failed to create an incoming connection thread instance: " + e.getMessage(), e);
                newIncomingSocketThread = null;
            }

            if (newIncomingSocketThread != null) {
                lowerBleDiscoveryPowerAndStartResetTimer();

                newIncomingSocketThread.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);
                newIncomingSocketThread.setPeerProperties(peerProperties);
                newIncomingSocketThread.setHttpPort(mServerPort);
                mPeerAndConnectionModel.addConnectionThread(newIncomingSocketThread);

                newIncomingSocketThread.start();

                Log.i(TAG, "onConnected: Incoming socket thread, for peer "
                        + peerProperties + ", created successfully");
            }
        } else {
            // Is outgoing connection
            OutgoingSocketThread newOutgoingSocketThread = null;
            final String tempPeerId = peerProperties.getId();
            final JxCoreExtensionListener listener = mOutgoingConnectionListeners.get(tempPeerId);

            try {
                newOutgoingSocketThread = new OutgoingSocketThread(bluetoothSocket, new ConnectionStatusListener() {
                    @Override
                    public void onListeningForIncomingConnections(int port) {
                        Log.i(TAG, "onListeningForIncomingConnections: Outgoing connection is using port "
                                + port + " (peer ID: " + tempPeerId + ")");

                        if (listener != null) {
                            listener.onConnectionStatusChanged(null, port);
                        }
                    }

                    @Override
                    public void onDataTransferred(int numberOfBytes) {
                        new Handler(jxcore.activity.getMainLooper()).post(new Runnable() {
                            @Override
                            public void run() {
                                thisInstance.lowerBleDiscoveryPowerAndStartResetTimer();
                            }
                        });
                    }

                    @Override
                    public void onDisconnected(SocketThreadBase who, String errorMessage) {
                        Log.w(TAG, "onDisconnected: Outgoing connection, peer "
                                + who.getPeerProperties().toString()
                                + " disconnected: " + errorMessage);
                        final String peerId = who.getPeerProperties().getId();

                        new Handler(jxcore.activity.getMainLooper()).post(new Runnable() {
                            @Override
                            public void run() {
                                thisInstance.mPeerAndConnectionModel
                                        .closeAndRemoveOutgoingConnectionThread(peerId, true);
                            }
                        });
                    }
                });
            } catch (IOException e) {
                Log.e(TAG, "onConnected: Failed to create an outgoing connection thread instance: " + e.getMessage(), e);
                newOutgoingSocketThread = null;

                if (listener != null) {
                    listener.onConnectionStatusChanged("Failed to create an outgoing connection thread instance: " + e.getMessage(), PORT_NUMBER_IN_ERROR_CASES);
                    mOutgoingConnectionListeners.remove(tempPeerId);
                }
            }

            if (newOutgoingSocketThread != null) {
                lowerBleDiscoveryPowerAndStartResetTimer();

                newOutgoingSocketThread.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);
                newOutgoingSocketThread.setPeerProperties(peerProperties);
                mPeerAndConnectionModel.addConnectionThread(newOutgoingSocketThread);

                newOutgoingSocketThread.start();

                Log.i(TAG, "onConnected: Outgoing socket thread, for peer "
                        + peerProperties + ", created successfully");

                // Use the system decided port the next time, if we're not already using
                ConnectionManagerSettings.getInstance(mContext).setInsecureRfcommSocketPortNumber(
                        ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT);
            }
        }

        Log.d(TAG, "onConnected: The total number of connections is now "
                + mPeerAndConnectionModel.getNumberOfCurrentConnections());
    }

    /**
     * Forwards the connection failure to the correct listener.
     * @param peerProperties The peer properties.
     */
    @Override
    public void onConnectionTimeout(PeerProperties peerProperties) {
        if (peerProperties != null) {
            final JxCoreExtensionListener listener = mOutgoingConnectionListeners.get(peerProperties.getId());

            if (listener != null) {
                listener.onConnectionStatusChanged("Connection to peer " + peerProperties.toString() + " timed out", PORT_NUMBER_IN_ERROR_CASES);
                mOutgoingConnectionListeners.remove(peerProperties.getId()); // Dispose the listener
            }

            toggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber();
        }
    }

    /**
     * Forwards the connection failure to the correct listener.
     * @param peerProperties The peer properties.
     * @param errorMessage The error message.
     */
    @Override
    public void onConnectionFailed(PeerProperties peerProperties, String errorMessage) {
        if (peerProperties != null) {
            final JxCoreExtensionListener listener = mOutgoingConnectionListeners.get(peerProperties.getId());

            if (listener != null) {
                listener.onConnectionStatusChanged("Connection to peer " + peerProperties.toString()
                        + " failed: " + errorMessage, PORT_NUMBER_IN_ERROR_CASES);

                mOutgoingConnectionListeners.remove(peerProperties.getId()); // Dispose the listener
            }

            toggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber();
        }
    }

    @Override
    public boolean onPermissionCheckRequired(String permission) {
        Log.i(TAG, "onPermissionCheckRequired: " + permission);
        Log.e(TAG, "onPermissionCheckRequired: Not implemented");

        // TODO: Implement

        return false;
    }

    /**
     * Does nothing but logs the new state.
     * @param discoveryManagerState The new state.
     */
    @Override
    public void onDiscoveryManagerStateChanged(DiscoveryManager.DiscoveryManagerState discoveryManagerState) {
        Log.i(TAG, "onDiscoveryManagerStateChanged: " + discoveryManagerState.toString());
    }

    @Override
    public void onProvideBluetoothMacAddressRequest(String requestId) {
        Log.d(TAG, "onProvideBluetoothMacAddressRequest: Request ID: " + requestId);
    }

    @Override
    public void onPeerReadyToProvideBluetoothMacAddress() {
        Log.d(TAG, "onPeerReadyToProvideBluetoothMacAddress");
    }

    @Override
    public void onBluetoothMacAddressResolved(String bluetoothMacAddress) {
        Log.d(TAG, "onBluetoothMacAddressResolved: " + bluetoothMacAddress);
    }

    /**
     * Called when a peer is discovered. Tries to add the peer to the list and notifies the listener.
     * @param peerProperties The peer properties.
     */
    @Override
    public void onPeerDiscovered(PeerProperties peerProperties) {
        Log.i(TAG, "onPeerDiscovered: " + peerProperties.toString()
                + ", Bluetooth address: " + peerProperties.getBluetoothAddress()
                + ", device name: " + peerProperties.getDeviceName()
                + ", device address: " + peerProperties.getDeviceAddress());

        if (mPeerAndConnectionModel.modifyListOfDiscoveredPeers(peerProperties, true)) {
            notifyPeerAvailability(peerProperties, true);
        }
    }

    /**
     * Called when one or more properties of a peer already discovered is updated.
     * @param peerProperties The peer properties.
     */
    @Override
    public void onPeerUpdated(PeerProperties peerProperties) {
        Log.i(TAG, "onPeerUpdated: " + peerProperties.toString()
                + ", Bluetooth address: " + peerProperties.getBluetoothAddress()
                + ", device name: " + peerProperties.getDeviceName()
                + ", device address: " + peerProperties.getDeviceAddress());
    }

    /**
     * Called when a peer is lost. Tries to remove the peer from the list and notifies the listener.
     * @param peerProperties The peer properties.
     */
    @Override
    public void onPeerLost(PeerProperties peerProperties) {
        Log.i(TAG, "onPeerLost: " + peerProperties.toString());

        // If we are still connected, the peer can't certainly be lost
        if (!mPeerAndConnectionModel.hasConnection(peerProperties.getId())
                && mPeerAndConnectionModel.modifyListOfDiscoveredPeers(peerProperties, false)) {
            notifyPeerAvailability(peerProperties, false);
        }
    }

    /**
     * From PeerAndConnectionModel.Listener
     *
     * @param peerId The ID of the peer.
     */
    @Override
    public void onConnectionClosed(String peerId) {
        mOutgoingConnectionListeners.remove(peerId);
    }

    /**
     * Notifies the JXcore layer of a peer availability changed event.
     * @param peerProperties The peer properties.
     * @param isAvailable If true, the peer is available. If false, it is not available.
     */
    private synchronized void notifyPeerAvailability(PeerProperties peerProperties, boolean isAvailable) {
        JSONObject jsonObject = new JSONObject();
        boolean jsonObjectCreated = false;

        try {
            jsonObject.put(JXcoreExtension.EVENT_VALUE_PEER_ID, peerProperties.getId());
            jsonObject.put(JXcoreExtension.EVENT_VALUE_PEER_NAME, peerProperties.getName());
            jsonObject.put(JXcoreExtension.EVENT_VALUE_PEER_AVAILABLE, isAvailable);
            jsonObjectCreated = true;
        } catch (JSONException e) {
            Log.e(TAG, "notifyPeerAvailability: Failed to create a JSON object: " + e.getMessage(), e);
        }

        if (jsonObjectCreated) {
            Log.d(TAG, "notifyPeerAvailability: Peer " + peerProperties.toString() + (isAvailable ? " is available" : " not available"));
            JSONArray jsonArray = new JSONArray();
            jsonArray.put(jsonObject);
            jxcore.CallJSMethod(JXcoreExtension.EVENT_NAME_PEER_AVAILABILITY_CHANGED, jsonArray.toString());
        }
    }

    /**
     * Lowers the BLE discovery power settings. If the power settings are already changed, the
     * timer for resetting the settings is restarted.
     * 
     * This method should be called when a data transfer is started to ensure a reasonable data
     * transfer speed as using BLE for discovery will likely interfere with the data transfer done
     * utilizing Bluetooth sockets.
     */
    private synchronized void lowerBleDiscoveryPowerAndStartResetTimer() {
        if (mPowerUpBleDiscoveryTimer == null) {
            DiscoveryManager.DiscoveryMode discoveryMode =
                    mDiscoveryManagerSettings.getDiscoveryMode();

            if (discoveryMode == DiscoveryManager.DiscoveryMode.BLE
                    || discoveryMode == DiscoveryManager.DiscoveryMode.BLE_AND_WIFI) {
                Log.i(TAG, "lowerBleDiscoveryPowerAndStartResetTimer: Lowering the power settings");

                // Create a timer to increase the power used by Bluetooth LE advertiser and scanner
                // once the data transfer is over.
                mPowerUpBleDiscoveryTimer = new CountDownTimer(
                        POWER_UP_BLE_DISCOVERY_DELAY_IN_MILLISECONDS, POWER_UP_BLE_DISCOVERY_DELAY_IN_MILLISECONDS) {
                    @Override
                    public void onTick(long millisUntilFinished) {
                        // Not used
                    }

                    @Override
                    public void onFinish() {
                        this.cancel();
                        Log.i(TAG, "Powering the BLE discovery back up");
                        mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED);
                        mDiscoveryManagerSettings.setScanMode(ScanSettings.SCAN_MODE_BALANCED);
                        mPowerUpBleDiscoveryTimer = null;
                    }
                };

                mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER);
                mDiscoveryManagerSettings.setScanMode(ScanSettings.SCAN_MODE_LOW_POWER);

                mPowerUpBleDiscoveryTimer.start();
            }
        } else {
            // Restart the timer
            mPowerUpBleDiscoveryTimer.cancel();
            mPowerUpBleDiscoveryTimer.start();
        }
    }
}
