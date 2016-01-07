/* Copyright (c) 2015 Microsoft Corporation. This software is licensed under the MIT License.
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
import org.thaliproject.p2p.btconnectorlib.*;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager.ConnectionManagerState;
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
            DiscoveryManager.DiscoveryManagerListener {
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
    private static final int MAXIMUM_NUMBER_OF_CONNECTIONS = 100; // TODO: Determine a way to figure out a proper value here
    private static final int PORT_NUMBER_IN_ERROR_CASES = -1;

    private final Context mContext;
    private final Thread.UncaughtExceptionHandler mThreadUncaughtExceptionHandler;
    private final CopyOnWriteArrayList<PeerProperties> mDiscoveredPeers = new CopyOnWriteArrayList<PeerProperties>();
    private final CopyOnWriteArrayList<IncomingSocketThread> mIncomingSocketThreads = new CopyOnWriteArrayList<IncomingSocketThread>();
    private final CopyOnWriteArrayList<OutgoingSocketThread> mOutgoingSocketThreads = new CopyOnWriteArrayList<OutgoingSocketThread>();
    private final HashMap<String, JxCoreExtensionListener> mOutgoingConnectionListeners = new HashMap<String, JxCoreExtensionListener>();
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
        mDiscoveryManagerSettings = DiscoveryManagerSettings.getInstance();

        if (!mDiscoveryManager.setDiscoveryMode(DiscoveryManager.DiscoveryMode.BLE_AND_WIFI)) {
            mDiscoveryManager.setDiscoveryMode(DiscoveryManager.DiscoveryMode.WIFI);
        }

        boolean connectionManagerStarted = mConnectionManager.start(peerName);
        boolean discoveryManagerStarted = false;

        if (connectionManagerStarted) {
            Log.i(TAG, "start: Using peer discovery mode: " + mDiscoveryManager.getDiscoveryMode());
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

        closeAndRemoveAllOutgoingConnections();
        closeAndRemoveAllIncomingConnections();
    }

    public boolean isRunning() {
        return (mConnectionManager != null && mDiscoveryManager != null);
    }

    /**
     * @return True, if BLE advertising is supported. False otherwise.
     */
    public boolean isBleAdvertisingSupported() {
        boolean isSupported = false;
        boolean discoveryManagerWasCreated = (mDiscoveryManager != null);

        if (discoveryManagerWasCreated) {
            isSupported = mDiscoveryManager.isBleAdvertisingSupported();
        } else {
            DiscoveryManager discoveryManager = new DiscoveryManager(mContext, this, BLE_SERVICE_UUID, SERVICE_TYPE);
            isSupported = discoveryManager.isBleAdvertisingSupported();
            discoveryManager = null;
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
        boolean success = closeAndRemoveOutgoingConnectionThread(peerId, false);

        if (success) {
            Log.i(TAG, "disconnectOutgoingConnection: Successfully disconnected (peer ID: " + peerId);
        } else {
            Log.w(TAG, "disconnectOutgoingConnection: Failed to disconnect (peer ID: " + peerId
                    + "), either no such connection or failed to close the connection");
        }

        return success;
    }

    /**
     * @return Our Bluetooth address or empty string, if not resolved.
     */
    public String getBluetoothAddress() {
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        return bluetooth == null ? "" : bluetooth.getAddress();
    }

    /**
     * @return Our Bluetooth friendly name or null, if Blueooth adapter
     * is not resolved or an error occurs while retrieving the name.
     */
    public String getBluetoothName() {
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        if (bluetooth != null) {
            return bluetooth.getName();
        }
        return null;
    }

    /**
     * Checks if we have an incoming connection with a peer matching the given peer ID.
     * @param peerId The peer ID.
     * @return True, if connected. False otherwise.
     */
    public synchronized boolean hasIncomingConnection(final String peerId) {
        return (findSocketThread(peerId, true) != null);
    }

    /**
     * Checks if we have an outgoing connection with a peer matching the given peer ID.
     * @param peerId The peer ID.
     * @return True, if connected. False otherwise.
     */
    public synchronized boolean hasOutgoingConnection(final String peerId) {
        return (findSocketThread(peerId, false) != null);
    }

    /**
     * Checks if we have either an incoming or outgoing connection with a peer matching the given ID.
     * @param peerId The peer ID.
     * @return True, if connected. False otherwise.
     */
    public synchronized boolean hasConnection(final String peerId) {
        boolean hasIncoming = hasIncomingConnection(peerId);
        boolean hasOutgoing = hasOutgoingConnection(peerId);

        if (hasIncoming) {
            Log.d(TAG, "hasConnection: We have an incoming connection with peer with ID " + peerId);
        }

        if (hasOutgoing) {
            Log.d(TAG, "hasConnection: We have an outgoing connection with peer with ID " + peerId);
        }

        if (!hasIncoming && !hasOutgoing){
            Log.d(TAG, "hasConnection: No connection with peer with ID " + peerId);
        }

        return (hasIncoming || hasOutgoing);
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
            if (hasConnection(peerIdToConnectTo)) {
                Log.i(TAG, "connect: We already have a connection to peer with ID " + peerIdToConnectTo);
            }

            if (mOutgoingSocketThreads.size() < MAXIMUM_NUMBER_OF_CONNECTIONS) {
                PeerProperties selectedDevice = findDiscoveredPeer(peerIdToConnectTo);

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
                        + mOutgoingSocketThreads.size()
                        + ") reached, please try again after disconnecting a peer");
                listener.onConnectionStatusChanged("Maximum number of peer connections ("
                        + mOutgoingSocketThreads.size()
                        + ") reached, please try again after disconnecting a peer", PORT_NUMBER_IN_ERROR_CASES);
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
        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance();

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

        if (hasConnection(peerProperties.getId())) {
            Log.w(TAG, "onConnected: Already connected with peer " + peerProperties.toString() + ", continuing anyway...");
        }

        // Add the peer to the list, if was not discovered before
        if (modifyListOfDiscoveredPeers(peerProperties, true)) {
            notifyPeerAvailability(peerProperties, true);
        }

        if (isIncoming) {
            IncomingSocketThread newIncomingSocketThread = null;

            try {
                newIncomingSocketThread = new IncomingSocketThread(bluetoothSocket, new ConnectionStatusListener() {
                    @Override
                    public void onDataTransferred(int numberOfBytes) {
                        lowerBleDiscoveryPowerAndStartResetTimer();
                    }

                    @Override
                    public void onDisconnected(SocketThreadBase who, String errorMessage) {
                        Log.w(TAG, "onDisconnected: Incoming connection, peer "
                                + who.getPeerProperties().toString()
                                + " disconnected: " + errorMessage);

                        closeAndRemoveIncomingConnectionThread(who.getId());
                    }
                });
            } catch (IOException e) {
                Log.e(TAG, "onConnected: Failed to create an incoming connection thread instance: " + e.getMessage(), e);
                newIncomingSocketThread = null;
            }

            if (newIncomingSocketThread != null) {
                newIncomingSocketThread.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);
                newIncomingSocketThread.setPeerProperties(peerProperties);
                newIncomingSocketThread.setHttpPort(mServerPort);
                mIncomingSocketThreads.add(newIncomingSocketThread);

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
                        lowerBleDiscoveryPowerAndStartResetTimer();
                    }

                    @Override
                    public void onDisconnected(SocketThreadBase who, String errorMessage) {
                        Log.w(TAG, "onDisconnected: Outgoing connection, peer "
                                + who.getPeerProperties().toString()
                                + " disconnected: " + errorMessage);

                        closeAndRemoveOutgoingConnectionThread(who.getPeerProperties().getId(), true);
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
                newOutgoingSocketThread.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);
                newOutgoingSocketThread.setPeerProperties(peerProperties);
                mOutgoingSocketThreads.add(newOutgoingSocketThread);

                newOutgoingSocketThread.start();

                Log.i(TAG, "onConnected: Outgoing socket thread, for peer "
                        + peerProperties + ", created successfully");

                // Use the system decided port the next time, if we're not already using
                ConnectionManagerSettings.getInstance().setInsecureRfcommSocketPortNumber(
                        ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT);
            }
        }

        Log.d(TAG, "onConnected: The total number of connections is now "
                + (mIncomingSocketThreads.size() + mOutgoingSocketThreads.size()));
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

    /**
     * Does nothing but logs the new state.
     * @param discoveryManagerState The new state.
     */
    @Override
    public void onDiscoveryManagerStateChanged(DiscoveryManager.DiscoveryManagerState discoveryManagerState) {
        Log.i(TAG, "onDiscoveryManagerStateChanged: " + discoveryManagerState.toString());
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

        if (modifyListOfDiscoveredPeers(peerProperties, true)) {
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
        if (!hasConnection(peerProperties.getId()) && modifyListOfDiscoveredPeers(peerProperties, false)) {
            notifyPeerAvailability(peerProperties, false);
        }
    }

    /**
     * Tries to find a socket thread with the given peer ID.
     * @param peerId The peer ID associated with the socket thread.
     * @param isIncoming If true, will search from incoming connections. If false, will search from outgoing connections.
     * @return The socket thread or null if not found.
     */
    private synchronized SocketThreadBase findSocketThread(final String peerId, final boolean isIncoming) {
        if (isIncoming) {
            for (IncomingSocketThread incomingSocketThread : mIncomingSocketThreads) {
                if (incomingSocketThread != null && incomingSocketThread.getPeerProperties().getId().equalsIgnoreCase(peerId)) {
                    return incomingSocketThread;
                }
            }
        } else {
            for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
                if (outgoingSocketThread != null && outgoingSocketThread.getPeerProperties().getId().equalsIgnoreCase(peerId)) {
                    return outgoingSocketThread;
                }
            }
        }

        return null;
    }

    /**
     * Closes and removes an incoming connection thread with the given ID.
     * @param incomingThreadId The ID of the incoming connection thread.
     * @return True, if the thread was found, the connection was closed and the thread was removed from the list.
     */
    private synchronized boolean closeAndRemoveIncomingConnectionThread(final long incomingThreadId) {
        boolean wasFoundClosedAndRemoved = false;

        for (IncomingSocketThread incomingSocketThread : mIncomingSocketThreads) {
            if (incomingSocketThread != null && incomingSocketThread.getId() == incomingThreadId) {
                Log.i(TAG, "closeAndRemoveIncomingConnectionThread: Closing and removing incoming connection thread with ID " + incomingThreadId);
                mIncomingSocketThreads.remove(incomingSocketThread);
                incomingSocketThread.close();
                wasFoundClosedAndRemoved = true;
                break;
            }
        }

        Log.d(TAG, "closeAndRemoveIncomingConnectionThread: " + mIncomingSocketThreads.size() + " incoming connection(s) left");
        return wasFoundClosedAndRemoved;
    }

    /**
     * Closes and removes an outgoing connection with the given peer ID.
     * @param peerId The ID of the peer to disconnect.
     * @param notifyError If true, will notify the Node layer about a connection error.
     * @return True, if the thread was found, the connection was closed and the thread was removed from the list.
     */
    private synchronized boolean closeAndRemoveOutgoingConnectionThread(
            final String peerId, boolean notifyError) {
        boolean wasFoundAndDisconnected = false;
        SocketThreadBase socketThread = findSocketThread(peerId, false);

        if (socketThread != null) {
            Log.i(TAG, "closeAndRemoveOutgoingConnectionThread: Closing connection, peer ID: " + peerId);
            mOutgoingConnectionListeners.remove(peerId);
            mOutgoingSocketThreads.remove(socketThread);
            socketThread.close();
            wasFoundAndDisconnected = true;

            if (notifyError) {
                JSONObject jsonObject = new JSONObject();

                try {
                    jsonObject.put(JXcoreExtension.EVENT_VALUE_PEER_ID, peerId);
                } catch (JSONException e) {
                    Log.e(TAG, "closeAndRemoveOutgoingConnectionThread: Failed to construct a JSON object: " + e.getMessage(), e);
                }

                jxcore.CallJSMethod(JXcoreExtension.EVENT_NAME_CONNECTION_ERROR, jsonObject.toString());
            }
        }

        if (!wasFoundAndDisconnected) {
            Log.e(TAG, "closeAndRemoveOutgoingConnectionThread: Failed to find an outgoing connection to peer with ID " + peerId);
        }

        Log.d(TAG, "closeAndRemoveOutgoingConnectionThread: " + mOutgoingSocketThreads.size() + " outgoing connection(s) left");
        return wasFoundAndDisconnected;
    }

    /**
     * Disconnects all outgoing connections.
     */
    private synchronized void closeAndRemoveAllOutgoingConnections() {
        for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
            if (outgoingSocketThread != null) {
                Log.d(TAG, "closeAndRemoveAllOutgoingConnections: Peer: " + outgoingSocketThread.getPeerProperties().toString());
                outgoingSocketThread.close();
            }
        }

        mOutgoingConnectionListeners.clear();
        mOutgoingSocketThreads.clear();
    }

    /**
     * Disconnects all incoming connections.
     * This method should only be used internally and should, in the future, made private.
     * For now, this method can be used for testing to emulate 'peer disconnecting' events.
     * @return The number of connections closed.
     */
    public synchronized int closeAndRemoveAllIncomingConnections() {
        int numberOfConnectionsClosed = 0;

        for (IncomingSocketThread incomingSocketThread : mIncomingSocketThreads) {
            if (incomingSocketThread != null) {
                Log.d(TAG, "closeAndRemoveAllIncomingConnections: Peer: " + incomingSocketThread.getPeerProperties().toString());
                incomingSocketThread.close();
                numberOfConnectionsClosed++;
            }
        }

        mIncomingSocketThreads.clear();
        return numberOfConnectionsClosed;
    }

    /**
     * Tries to find a peer with the given ID.
     * @param peerId The ID of the peer to find.
     * @return The properties of the found peer or null, if not found.
     */
    private synchronized PeerProperties findDiscoveredPeer(final String peerId) {
        PeerProperties peerProperties = null;

        for (PeerProperties existingPeerProperties : mDiscoveredPeers) {
            if (existingPeerProperties != null && existingPeerProperties.getId().contentEquals(peerId)) {
                peerProperties = existingPeerProperties;
                break;
            }
        }

        return peerProperties;
    }

    /**
     * Adds/removes the given peer to/from the list of discovered peers.
     * @param peerProperties The peer properties.
     * @param add If true, will try to add. If false, will try to remove.
     * @return True, if successfully added/removed.
     */
    private synchronized boolean modifyListOfDiscoveredPeers(PeerProperties peerProperties, boolean add) {
        boolean success = false;

        if (add) {
            if (findDiscoveredPeer(peerProperties.getId()) != null) {
                Log.w(TAG, "modifyListOfDiscoveredPeers: Peer " + peerProperties.toString()
                        + " already in the list, will not add again");
            } else {
                mDiscoveredPeers.add(peerProperties);
                success = true;
            }
        } else {
            // Remove
            PeerProperties peerPropertiesToRemove = findDiscoveredPeer(peerProperties.getId());

            if (peerPropertiesToRemove != null && mDiscoveredPeers.remove(peerPropertiesToRemove)) {
                Log.d(TAG, "modifyListOfDiscoveredPeers: Peer " + peerProperties.toString() + " removed");
                success = true;
            }
        }

        return success;
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
     * Lowers the BLE discovery power settings.
     * This method should be called when a data transfer is started to ensure a reasonable data
     * transfer speed as using BLE for discovery will likely interfere with the data transfer done
     * utilizing Bluetooth sockets.
     */
    private synchronized void lowerBleDiscoveryPowerAndStartResetTimer() {
        if (mPowerUpBleDiscoveryTimer == null) {
            DiscoveryManager.DiscoveryMode discoveryMode =
                    mDiscoveryManager.getDiscoveryMode();

            if (discoveryMode == DiscoveryManager.DiscoveryMode.BLE
                    || discoveryMode == DiscoveryManager.DiscoveryMode.BLE_AND_WIFI) {
                mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER);
                mDiscoveryManagerSettings.setScanMode(ScanSettings.SCAN_MODE_LOW_POWER);
                createAndStartPowerUpBleDiscoveryTimer();
            }
        } else {
            // Restart the timer
            mPowerUpBleDiscoveryTimer.cancel();
            mPowerUpBleDiscoveryTimer.start();
        }
    }

    /**
     * Creates a timer to increase the power used by Bluetooth LE advertiser and scanner.
     * The timer is used to restore the higher power settings after data transfer is over.
     * During data transfer the BLE discovery needs to run a lower settings or otherwise the
     * data transfer speed will be extremely low.
     */
    private synchronized void createAndStartPowerUpBleDiscoveryTimer() {
        if (mPowerUpBleDiscoveryTimer != null) {
            mPowerUpBleDiscoveryTimer.cancel();
            mPowerUpBleDiscoveryTimer = null;
        }

        mPowerUpBleDiscoveryTimer = new CountDownTimer(
                POWER_UP_BLE_DISCOVERY_DELAY_IN_MILLISECONDS, POWER_UP_BLE_DISCOVERY_DELAY_IN_MILLISECONDS) {
            @Override
            public void onTick(long millisUntilFinished) {
                // Not used
            }

            @Override
            public void onFinish() {
                this.cancel();
                mDiscoveryManagerSettings.setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED);
                mDiscoveryManagerSettings.setScanMode(ScanSettings.SCAN_MODE_BALANCED);
                mPowerUpBleDiscoveryTimer = null;
            }
        }.start();
    }
}
