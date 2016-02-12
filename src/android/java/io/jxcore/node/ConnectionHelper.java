/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothSocket;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.CountDownTimer;
import android.os.Handler;
import android.util.Log;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager.ConnectionManagerState;
import org.thaliproject.p2p.btconnectorlib.ConnectionManagerSettings;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManagerSettings;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import io.jxcore.node.JXcoreExtension.JxCoreExtensionListener;
import java.io.IOException;
import java.util.UUID;

/**
 * Wraps the Android connector library functionality and provides an interface for JXcore layer
 * (with the help of JXcoreExtensions class).
 */
public class ConnectionHelper
        implements
            ConnectionManager.ConnectionManagerListener,
            DiscoveryManager.DiscoveryManagerListener,
            ConnectionModel.Listener {
    private static final String TAG = ConnectionHelper.class.getName();

    public static final int NO_PORT_NUMBER = -1;
    private static final String SERVICE_TYPE = "Cordovap2p._tcp";
    private static final String SERVICE_UUID_AS_STRING = "fa87c0d0-afac-11de-8a39-0800200c9a66";
    private static final String BLE_SERVICE_UUID_AS_STRING = "b6a44ad1-d319-4b3a-815d-8b805a47fb51";
    private static final String BLUETOOTH_NAME = "Thali_Bluetooth";
    private static final String PEER_NAME = Build.MANUFACTURER + "_" + Build.MODEL; // Use manufacturer and device model name as the peer name
    private static final UUID SERVICE_UUID = UUID.fromString(SERVICE_UUID_AS_STRING);
    private static final UUID BLE_SERVICE_UUID = UUID.fromString(BLE_SERVICE_UUID_AS_STRING);
    private static final long POWER_UP_BLE_DISCOVERY_DELAY_IN_MILLISECONDS = 15000;
    private static final int MAXIMUM_NUMBER_OF_CONNECTIONS = 30; // TODO: Determine a way to figure out a proper value here
    private static final int PORT_NUMBER_IN_ERROR_CASES = -1;

    private final Context mContext;
    private final Thread.UncaughtExceptionHandler mThreadUncaughtExceptionHandler;
    private final ConnectionModel mConnectionModel;
    private ConnectionManager mConnectionManager = null;
    private DiscoveryManager mDiscoveryManager = null;
    private DiscoveryManagerSettings mDiscoveryManagerSettings = null;
    private CountDownTimer mPowerUpBleDiscoveryTimer = null;
    private int mServerPortNumber = 0;

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

        mConnectionModel = new ConnectionModel(this);

        mConnectionManager = new ConnectionManager(mContext, this, SERVICE_UUID, BLUETOOTH_NAME);
        mConnectionManager.setPeerName(PEER_NAME);

        mDiscoveryManager = new DiscoveryManager(mContext, this, BLE_SERVICE_UUID, SERVICE_TYPE);
        mDiscoveryManager.setPeerName(PEER_NAME);

        mDiscoveryManagerSettings = DiscoveryManagerSettings.getInstance(mContext);

        if (mDiscoveryManagerSettings.setDiscoveryMode(DiscoveryManager.DiscoveryMode.BLE)) {
            mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY);
            mDiscoveryManagerSettings.setAdvertiseTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH);
            mDiscoveryManagerSettings.setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY);
        } else {
            mDiscoveryManagerSettings.setDiscoveryMode(DiscoveryManager.DiscoveryMode.WIFI);
        }
    }

    /**
     * Should be called when this class instance is no longer needed.
     * Note that after calling this method, this instance cannot be used anymore.
     */
    public void dispose() {
        mConnectionManager.dispose();
        mDiscoveryManager.dispose();
    }

    /**
     * Starts the connection manager and the discovery manager.
     * @param portNumber The port on 127.0.0.1 that any incoming connections over the native
     *                   non-TCP/IP transport should be bridged to.
     *                   Use a negative value, if you don not wish to set the port number.
     * @param startAdvertisements If true, will start advertising our presence and scanning for other peers.
     *                            If false, will only scan for other peers.
     * @return True, if started successfully. False otherwise.
     */
    public synchronized boolean start(int portNumber, boolean startAdvertisements) {
        Log.i(TAG, "start: "
                + ((portNumber >= 0) ? "Port number: " + portNumber : "Port number not set")
                + ", start advertisements: " + startAdvertisements);

        if (portNumber >= 0) {
            mServerPortNumber = portNumber;
        }

        boolean connectionManagerStarted = mConnectionManager.start();
        boolean discoveryManagerStarted = false;

        if (connectionManagerStarted) {
            discoveryManagerStarted = mDiscoveryManager.start(true, startAdvertisements);

            if (discoveryManagerStarted) {
                Log.i(TAG, "start: OK");
            } else {
                Log.e(TAG, "start: Failed to start the discovery manager");
            }
        } else {
            Log.e(TAG, "start: Failed to start the connection manager");
        }

        return (connectionManagerStarted && discoveryManagerStarted);
    }

    /**
     * Stops all activities and kills all connections.
     */
    public synchronized void stop() {
        Log.i(TAG, "stop: Stopping all activities and killing all connections...");
        mConnectionManager.stop();
        mDiscoveryManager.stop();
        killAllConnections();
    }

    /**
     * Stops scanning/discovering peers. Call start to restart.
     */
    public synchronized void stopListeningForAdvertisements() {
        Log.i(TAG, "stopListeningForAdvertisements");
        mDiscoveryManager.stopDiscovery();
    }

    /**
     * Kills all connections.
     * @return The number of incoming connections killed.
     */
    public synchronized int killAllConnections() {
        mConnectionModel.closeAndRemoveAllOutgoingConnections();
        return mConnectionModel.closeAndRemoveAllIncomingConnections();
    }

    /**
     * @return True, if both the connection and the discovery manager are running.
     */
    public boolean isRunning() {
        return (mConnectionManager.getState() != ConnectionManagerState.NOT_STARTED
                && mDiscoveryManager.isRunning());
    }

    /**
     * @return The connection manager instance.
     */
    public final ConnectionManager getConnectionManager() {
        return mConnectionManager;
    }

    /**
     * @return The discovery manager instance.
     */
    public final DiscoveryManager getDiscoveryManager() {
        return mDiscoveryManager;
    }

    /**
     * @return The connection model.
     */
    public final ConnectionModel getConnectionModel() {
        return mConnectionModel;
    }

    /**
     * Disconnects the outgoing connection with the given peer ID.
     * @param peerId The ID of the peer to disconnect.
     * @return True, if the peer was found and disconnected.
     */
    public synchronized boolean disconnectOutgoingConnection(final String peerId) {
        Log.d(TAG, "disconnectOutgoingConnection: Trying to close connection to peer with ID " + peerId);
        boolean success = mConnectionModel.closeAndRemoveOutgoingConnectionThread(peerId, false);

        if (success) {
            Log.i(TAG, "disconnectOutgoingConnection: Successfully disconnected (peer ID: " + peerId);
        } else {
            Log.w(TAG, "disconnectOutgoingConnection: Failed to disconnect (peer ID: " + peerId
                    + "), either no such connection or failed to close the connection");
        }

        return success;
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
     * @return True, if the maximum number of simultaneous connections has been reached (or exceeded).
     */
    public synchronized boolean hasMaximumNumberOfConnections() {
        return (mConnectionModel.getNumberOfCurrentOutgoingConnections() >= MAXIMUM_NUMBER_OF_CONNECTIONS);
    }

    /**
     * Starts the connection process to a peer with the given ID.
     * @param bluetoothMacAddress The Bluetooth MAC address of the peer to connect to.
     * @param listener The listener.
     * @return True, if the connection attempt was initiated successfully. False otherwise.
     */
    public synchronized boolean connect(final String bluetoothMacAddress, JxCoreExtensionListener listener) {
        Log.i(TAG, "connect: Trying to connect to peer with ID " + bluetoothMacAddress);
        boolean success = false;

        if (listener == null) {
            Log.e(TAG, "connect: Listener is null");
            throw new NullPointerException("Listener is null");
        }

        if (isRunning()) {
            if (!mConnectionModel.hasOutgoingConnection(bluetoothMacAddress)) {
                if (mConnectionModel.hasIncomingConnection(bluetoothMacAddress)) {
                    Log.i(TAG, "connect: We already have an incoming connection to peer with ID "
                            + bluetoothMacAddress + ", but will connect anyway...");
                }

                if (!hasMaximumNumberOfConnections()) {
                    PeerProperties selectedDevice =
                            mDiscoveryManager.getPeerModel().getDiscoveredPeerByBluetoothMacAddress(
                                    bluetoothMacAddress);

                    if (selectedDevice == null) {
                        Log.w(TAG, "connect: The peer to connect to is not amongst the discovered peers, but trying anyway...");
                        selectedDevice = new PeerProperties(PeerProperties.NO_PEER_NAME_STRING, bluetoothMacAddress);
                    }

                    if (BluetoothAdapter.checkBluetoothAddress(selectedDevice.getBluetoothMacAddress())) {
                        if (mConnectionManager.connect(selectedDevice)) {
                            Log.i(TAG, "connect: Connection process successfully started (peer ID: " + bluetoothMacAddress + ")");
                            mConnectionModel.addOutgoingConnectionListener(bluetoothMacAddress, listener);
                            success = true;
                        } else {
                            Log.e(TAG, "connect: Failed to start connecting");
                        }
                    } else {
                        Log.e(TAG, "connect: Invalid Bluetooth MAC address: " + selectedDevice.getBluetoothMacAddress());
                    }
                } else {
                    Log.e(TAG, "connect: Maximum number of peer connections ("
                            + mConnectionModel.getNumberOfCurrentOutgoingConnections()
                            + ") reached, please try again after disconnecting a peer");
                }
            } else {
                Log.w(TAG, "connect: We already have an outgoing connection to peer with ID "
                        + bluetoothMacAddress + ", aborting...");

            }
        } else {
            Log.e(TAG, "connect: Not running, please call start() first");
        }

        return success;
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

        if (mConnectionModel.hasConnection(peerProperties.getId())) {
            Log.w(TAG, "onConnected: Already connected with peer " + peerProperties.toString() + ", continuing anyway...");
        }

        // Add the peer to the list, if was not discovered before
        mDiscoveryManager.getPeerModel().addOrUpdateDiscoveredPeer(peerProperties);

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
                                thisInstance.mConnectionModel
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
                newIncomingSocketThread.setHttpPort(mServerPortNumber);
                mConnectionModel.addConnectionThread(newIncomingSocketThread);

                newIncomingSocketThread.start();

                Log.i(TAG, "onConnected: Incoming socket thread, for peer "
                        + peerProperties + ", created successfully");
            }
        } else {
            // Is outgoing connection
            OutgoingSocketThread newOutgoingSocketThread = null;
            final String finalPeerId = peerProperties.getId();
            final JxCoreExtensionListener listener = mConnectionModel.getOutgoingConnectionListener(finalPeerId);

            try {
                newOutgoingSocketThread = new OutgoingSocketThread(bluetoothSocket, new ConnectionStatusListener() {
                    @Override
                    public void onListeningForIncomingConnections(int port) {
                        Log.i(TAG, "onListeningForIncomingConnections: Outgoing connection is using port "
                                + port + " (peer ID: " + finalPeerId + ")");

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
                                thisInstance.mConnectionModel
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
                    mConnectionModel.removeOutgoingConnectionListener(finalPeerId);
                }
            }

            if (newOutgoingSocketThread != null) {
                lowerBleDiscoveryPowerAndStartResetTimer();

                newOutgoingSocketThread.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);
                newOutgoingSocketThread.setPeerProperties(peerProperties);
                mConnectionModel.addConnectionThread(newOutgoingSocketThread);

                newOutgoingSocketThread.start();

                Log.i(TAG, "onConnected: Outgoing socket thread, for peer "
                        + peerProperties + ", created successfully");

                // Use the system decided port the next time, if we're not already using
                ConnectionManagerSettings.getInstance(mContext).setInsecureRfcommSocketPortNumber(
                        ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT);
            }
        }

        Log.d(TAG, "onConnected: The total number of connections is now "
                + mConnectionModel.getNumberOfCurrentConnections());
    }

    /**
     * Forwards the connection failure to the correct listener.
     * @param peerProperties The peer properties.
     */
    @Override
    public void onConnectionTimeout(PeerProperties peerProperties) {
        if (peerProperties != null) {
            final String bluetoothMacAddress = peerProperties.getBluetoothMacAddress();
            final JxCoreExtensionListener listener = mConnectionModel.getOutgoingConnectionListener(bluetoothMacAddress);

            if (listener != null) {
                listener.onConnectionStatusChanged("Connection to peer " + peerProperties.toString() + " timed out", PORT_NUMBER_IN_ERROR_CASES);
                mConnectionModel.removeOutgoingConnectionListener(bluetoothMacAddress); // Dispose the listener
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
            final String bluetoothMacAddress = peerProperties.getBluetoothMacAddress();
            final JxCoreExtensionListener listener = mConnectionModel.getOutgoingConnectionListener(bluetoothMacAddress);

            if (listener != null) {
                listener.onConnectionStatusChanged("Connection to peer " + peerProperties.toString()
                        + " failed: " + errorMessage, PORT_NUMBER_IN_ERROR_CASES);

                mConnectionModel.removeOutgoingConnectionListener(bluetoothMacAddress); // Dispose the listener
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
                + ", Bluetooth address: " + peerProperties.getBluetoothMacAddress()
                + ", device name: " + peerProperties.getDeviceName()
                + ", device address: " + peerProperties.getDeviceAddress());

        JXcoreExtension.notifyPeerAvailability(peerProperties, true);
    }

    /**
     * Called when one or more properties of a peer already discovered is updated.
     * @param peerProperties The peer properties.
     */
    @Override
    public void onPeerUpdated(PeerProperties peerProperties) {
        Log.i(TAG, "onPeerUpdated: " + peerProperties.toString()
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

        if (mConnectionModel.hasConnection(peerProperties.getId())) {
            // If we are still connected, the peer can't certainly be lost, add it back
            mDiscoveryManager.getPeerModel().addOrUpdateDiscoveredPeer(peerProperties);
        } else {
            JXcoreExtension.notifyPeerAvailability(peerProperties, false);
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
                        mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY);
                        mDiscoveryManagerSettings.setAdvertiseTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH);
                        mDiscoveryManagerSettings.setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY);
                        mPowerUpBleDiscoveryTimer = null;
                    }
                };

                mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER);
                mDiscoveryManagerSettings.setAdvertiseTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_LOW);
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
