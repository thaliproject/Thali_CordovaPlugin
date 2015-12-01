package io.jxcore.node;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager.ConnectionManagerState;
import org.thaliproject.p2p.btconnectorlib.PeerDeviceProperties;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 *
 */
public class ConnectionHelper implements ConnectionManager.ConnectionManagerListener {
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
    private static final String BLUETOOTH_UUID_AS_STRING = "fa87c0d0-afac-11de-8a39-0800200c9a66";
    private static final String BLUETOOTH_NAME = "Thaili_Bluetooth";
    private static final UUID BLUETOOTH_UUID = UUID.fromString(BLUETOOTH_UUID_AS_STRING);
    private static final int MAXIMUM_NUMBER_OF_CONNECTIONS = 100; // TODO: Determine a way to figure out a proper value here
    private static final int PORT_NUMBER_IN_ERROR_CASES = -1;

    private final Context mContext;
    private final Thread.UncaughtExceptionHandler mThreadUncaughtExceptionHandler;
    private final CopyOnWriteArrayList<PeerDeviceProperties> mLastPeerDeviceList = new CopyOnWriteArrayList<PeerDeviceProperties>();
    private final CopyOnWriteArrayList<IncomingSocketThread> mIncomingSocketThreads = new CopyOnWriteArrayList<IncomingSocketThread>();
    private final CopyOnWriteArrayList<OutgoingSocketThread> mOutgoingSocketThreads = new CopyOnWriteArrayList<OutgoingSocketThread>();
    private final HashMap<String, JxCoreExtensionListener> mOutgoingConnectionListeners = new HashMap<String, JxCoreExtensionListener>();
    private ConnectionManager mConnectionManager = null;
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
     *
     * @param peerName
     * @param port
     * @return
     */
    public synchronized boolean start(String peerName, int port) {
        stop();
        mServerPort = port;

        mConnectionManager = new ConnectionManager(
                mContext, this, BLUETOOTH_UUID, BLUETOOTH_NAME, SERVICE_TYPE);

        if (mConnectionManager.initialize(getBluetoothAddress(), peerName)) {
            if (mLastPeerDeviceList.size() > 0) {
                JSONArray jsonArray = new JSONArray();

                for (PeerDeviceProperties peerDeviceProperties : mLastPeerDeviceList) {
                    jsonArray.put(getAvailabilityStatus(peerDeviceProperties, true));
                }

                jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, jsonArray.toString());
            }

            Log.i(TAG, "start: OK");
        } else {
            mConnectionManager = null;
        }

        return (mConnectionManager != null);
    }

    /**
     * Stops all activities and disconnects all active connections.
     */
    public synchronized void stop() {
        if (mConnectionManager != null) {
            Log.i(TAG, "stop");
            mConnectionManager.deinitialize();
            mConnectionManager = null;
        }

        disconnectAllOutgoingConnections();
        disconnectAllIncomingConnections();
    }

    public boolean isRunning() {
        return (mConnectionManager != null);
    }

    /**
     * Disconnects the outgoing connection with the given peer ID.
     * @param peerId The ID of the peer to disconnect.
     * @return True, if the peer was found and disconnected.
     */
    public synchronized boolean disconnectOutgoingConnection(final String peerId) {
        boolean wasFoundAndDisconnected = false;

        for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
            if (outgoingSocketThread != null && outgoingSocketThread.getPeerId().equalsIgnoreCase(peerId)) {
                Log.i(TAG, "closeAndRemoveOutgoingConnectionThread: Disconnecting connection, peer ID: " + peerId);
                mOutgoingConnectionListeners.remove(peerId);
                mOutgoingSocketThreads.remove(outgoingSocketThread);
                outgoingSocketThread.close();
                wasFoundAndDisconnected = true;
                break;
            }
        }

        return wasFoundAndDisconnected;
    }

    /**
     * @return Our Bluetooth address or empty string, if not resolved.
     */
    public String getBluetoothAddress() {
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        return bluetooth == null ? "" : bluetooth.getAddress();
    }

    /**
     * TODO: This method should be moved to BluetoothManager class of the Bluetooth library.
     * @return
     */
    @TargetApi(18)
    @SuppressLint("NewApi")
    public String isBleAdvertisingSupported() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return "Build version is " + Build.VERSION.SDK_INT;
        }

        if (!mContext.getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)){
            return "Feature FEATURE_BLUETOOTH_LE not found";
        }

        BluetoothManager tmpMan = (BluetoothManager) mContext.getSystemService(Context.BLUETOOTH_SERVICE);

        if (tmpMan == null) {
            return "Can not get BLUETOOTH_SERVICE";
        }

        BluetoothAdapter tmpAdapter = tmpMan.getAdapter();

        if (tmpAdapter == null) {
            return "got NULL BluetoothAdapter";
        }

        if (!tmpAdapter.isMultipleAdvertisementSupported()) {
            return "MultipleAdvertisement not supported";
        }

        return null;
    }

    /**
     * Checks if we have an incoming connection with a peer matching the given peer ID.
     * @param peerId The peer ID.
     * @return True, if connected. False otherwisae.
     */
    public synchronized boolean hasIncomingConnection(final String peerId) {
        boolean isConnected = false;

        for (IncomingSocketThread incomingSocketThread : mIncomingSocketThreads) {
            if (incomingSocketThread != null && incomingSocketThread.getPeerId().equalsIgnoreCase(peerId)) {
                isConnected = true;
                break;
            }
        }

        return isConnected;
    }

    /**
     * Checks if we have an outgoing connection with a peer matching the given peer ID.
     * @param peerId The peer ID.
     * @return True, if connected. False otherwisae.
     */
    public synchronized boolean hasOutgoingConnection(final String peerId) {
        boolean isConnected = false;

        for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
            if (outgoingSocketThread != null && outgoingSocketThread.getPeerId().equalsIgnoreCase(peerId)) {
                isConnected = true;
                break;
            }
        }

        return isConnected;
    }

    /**
     * Checks if we have either an incoming or outgoing connection with a peer matching the given ID.
     * @param peerId The peer ID.
     * @return True, if connected. False otherwisae.
     */
    public synchronized boolean hasConnection(final String peerId) {
        boolean hasIncoming = hasIncomingConnection(peerId);
        boolean hasOutgoing = hasOutgoingConnection(peerId);

        if (hasIncoming) {
            Log.i(TAG, "hasConnection: We have an incoming connection with peer with ID " + peerId);
        }

        if (hasOutgoing) {
            Log.i(TAG, "hasConnection: We have an outgoing connection with peer with ID " + peerId);
        }

        if (!hasIncoming && !hasOutgoing){
            Log.i(TAG, "hasConnection: No connection with peer with ID " + peerId);
        }

        return (hasIncoming || hasOutgoing);
    }

    /**
     *
     * @param peerIdToConnectTo
     * @param listener
     */
    public synchronized void connect(final String peerIdToConnectTo, JxCoreExtensionListener listener) {
        Log.i(TAG, "connect: Trying to connect to peer with ID " + peerIdToConnectTo);

        if (listener == null) {
            Log.e(TAG, "connect: Listener is null");
            throw new NullPointerException("Listener is null");
        }

        if (isRunning()) {
            if (hasConnection(peerIdToConnectTo)) {
                Log.w(TAG, "connect: We are already connected to peer with ID " + peerIdToConnectTo
                        + ", just saying, trying to connect anyway...");
            }

            if (mOutgoingSocketThreads.size() < MAXIMUM_NUMBER_OF_CONNECTIONS) {
                PeerDeviceProperties selectedDevice = null;

                for (PeerDeviceProperties peerDeviceProperties : mLastPeerDeviceList) {
                    if (peerDeviceProperties != null
                            && peerDeviceProperties.peerId.contentEquals(peerIdToConnectTo)) {
                        selectedDevice = peerDeviceProperties;
                        break;
                    }
                }

                if (selectedDevice == null) {
                    Log.w(TAG, "connect: The peer to connect to is not amongst the discovered peers, but trying anyway...");
                    selectedDevice = new PeerDeviceProperties(
                            peerIdToConnectTo, peerIdToConnectTo, peerIdToConnectTo, "", "", "");
                }

                if (BluetoothAdapter.checkBluetoothAddress(selectedDevice.peerBluetoothAddress)) {
                    if (mConnectionManager.connect(selectedDevice)) {
                        Log.i(TAG, "connect: Connection process successfully started (peer ID: " + peerIdToConnectTo + ")");
                        mOutgoingConnectionListeners.put(peerIdToConnectTo, listener);
                    } else {
                        Log.e(TAG, "connect: Failed to start connecting");
                        listener.onConnectionStatusChanged("Failed to start connecting", PORT_NUMBER_IN_ERROR_CASES);
                    }
                } else {
                    Log.e(TAG, "connect: Invalid Bluetooth address: " + selectedDevice.peerBluetoothAddress);
                    listener.onConnectionStatusChanged(
                            "Invalid Bluetooth address: " + selectedDevice.peerBluetoothAddress, PORT_NUMBER_IN_ERROR_CASES);
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
     * Does nothing but logs the new state.
     * @param state The new state.
     */
    @Override
    public void onConnectionManagerStateChanged(ConnectionManagerState state) {
        Log.i(TAG, "onConnectionManagerStateChanged: " + state.toString());

        switch (state) {
            case NOT_INITIALIZED:
                break;
            case WAITING_FOR_SERVICES_TO_BE_ENABLED:
                break;
            case INITIALIZED:
                break;
            case RUNNING:
                break;
            default:
                throw new RuntimeException("Unrecognized ConnectionManagerState: " + state.toString());
        }
    }

    /**
     * Does nothing but logs the event.
     * @param peerDevicePropertiesList
     */
    @Override
    public void onPeerListChanged(final List<PeerDeviceProperties> peerDevicePropertiesList) {
        if (peerDevicePropertiesList != null) {
            Log.w(TAG, "onPeerListChanged: Got a list containing " + peerDevicePropertiesList.size() + " peer(s), but doing nothing with that list");
        } else {
            Log.w(TAG, "onPeerListChanged: Got a list of peers, which is null");
        }
    }

    /**
     * Called when a peer is discovered. If this was a new peer (not in the list), it is added to
     * the list and Node layer is notified.
     * @param peerDeviceProperties The properties of the peer.
     */
    @Override
    public void onPeerDiscovered(PeerDeviceProperties peerDeviceProperties) {
        Log.i(TAG, "onPeerDiscovered: Bluetooth address: " + peerDeviceProperties.peerBluetoothAddress
                + ", peer name: " + peerDeviceProperties.peerName
                + ", peer ID: " + peerDeviceProperties.peerId
                + ", Wi-Fi Direct device name: " + peerDeviceProperties.deviceName
                + ", Wi-Fi Direct address: " + peerDeviceProperties.deviceAddress);

        addNewPeerToListAndNotify(peerDeviceProperties);
    }

    /**
     *
     * @param bluetoothSocket
     * @param isIncoming
     * @param peerId
     * @param peerName
     * @param peerBluetoothAddress
     */
    @Override
    public void onConnected(
            BluetoothSocket bluetoothSocket, boolean isIncoming,
            String peerId, String peerName, String peerBluetoothAddress) {

        String incomingOrOutgoing = isIncoming ? "Incoming" : "Outgoing";
        Log.i(TAG, "onConnected: " + incomingOrOutgoing + " connection"
                + ", peer ID: " + peerId + ", name: " + peerName
                + ", Bluetooth address: " + peerBluetoothAddress);

        if (bluetoothSocket == null) {
            Log.e(TAG, "onConnected: Bluetooth socket is null");
            throw new RuntimeException("onConnected: Bluetooth socket is null");
        }

        // Add the peer to the list, if was not discovered before
        addNewPeerToListAndNotify(bluetoothSocket, peerId, peerName, peerBluetoothAddress);

        if (isIncoming) {
            if (hasConnection(peerId)) {
                Log.w(TAG, "onConnected: Already connected with peer (ID: " + peerId + "), but continuing anyway...");
            }

            IncomingSocketThread newIncomingSocketThread = null;

            try {
                newIncomingSocketThread = new IncomingSocketThread(bluetoothSocket, new ConnectionStatusListener() {
                    @Override
                    public void onDisconnected(SocketThreadBase who, String errorMessage) {
                        Log.w(TAG, "onDisconnected: Incoming connection, peer with ID " + who.getPeerId()
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
                newIncomingSocketThread.setPeerProperties(peerId, peerName, peerBluetoothAddress);
                newIncomingSocketThread.setHttpPort(mServerPort);
                mIncomingSocketThreads.add(newIncomingSocketThread);

                newIncomingSocketThread.start();

                Log.i(TAG, "onConnected: Incoming socket thread using port "
                        + newIncomingSocketThread.getLocalHostPort()
                        + " and is now connected (peer ID: " + peerId + ")");
            }
        } else {
            // Is outgoing connection
            OutgoingSocketThread newOutgoingSocketThread = null;
            final String tempPeerId = peerId;
            final JxCoreExtensionListener listener = mOutgoingConnectionListeners.get(peerId);

            try {
                newOutgoingSocketThread = new OutgoingSocketThread(bluetoothSocket, new ConnectionStatusListener() {
                    /**
                     * There is a good chance of a race condition where the node.js gets to do its
                     * client socket before we get the accept line executed. Thus, this callback
                     * takes care that we are ready before node.js is.
                     * @param port The port listening to.
                     */
                    @Override
                    public void onListeningForIncomingConnections(int port) {
                        final int tempPort = port;
                        Log.i(TAG, "onListeningForIncomingConnections: Outgoing connection is using port "
                                + tempPort + " (peer ID: " + tempPeerId + ")");

                        new Handler(jxcore.activity.getMainLooper()).postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                if (listener != null) {
                                    listener.onConnectionStatusChanged(null, tempPort);
                                }
                            }
                        }, 300); // TODO: Get rid of the magic number
                    }

                    @Override
                    public void onDisconnected(SocketThreadBase who, String errorMessage) {
                        Log.w(TAG, "onDisconnected: Outgoing connection, peer with ID " + who.getPeerId()
                                + " disconnected: " + errorMessage);
                        closeAndRemoveOutgoingConnectionThread(who.getId(), true);
                    }
                });
            } catch (IOException e) {
                Log.e(TAG, "Failed to create an outgoing connection thread instance: " + e.getMessage(), e);
                newOutgoingSocketThread = null;

                if (listener != null) {
                    listener.onConnectionStatusChanged("Failed to create an outgoing connection thread instance: " + e.getMessage(), PORT_NUMBER_IN_ERROR_CASES);
                    mOutgoingConnectionListeners.remove(peerId);
                }
            }

            if (newOutgoingSocketThread != null) {
                newOutgoingSocketThread.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);
                newOutgoingSocketThread.setPeerProperties(peerId, peerName, peerBluetoothAddress);
                mOutgoingSocketThreads.add(newOutgoingSocketThread);

                newOutgoingSocketThread.start();

                Log.i(TAG, "onConnected: Outgoing socket thread, for peer with ID " + peerId + ", created successfully");
            }
        }
    }

    /**
     * Forwards the connection failure to the correct listener.
     * @param peerId
     * @param peerName
     * @param peerBluetoothAddress
     */
    @Override
    public void onConnectionFailed(String peerId, String peerName, String peerBluetoothAddress) {
        final JxCoreExtensionListener listener = mOutgoingConnectionListeners.get(peerId);

        if (listener != null) {
            listener.onConnectionStatusChanged("Connection to peer with ID " + peerId + " failed", PORT_NUMBER_IN_ERROR_CASES);
            mOutgoingConnectionListeners.remove(peerId); // Dispose the listener
        }
    }

    /**
     * Checks whether a peer with the given ID is in the list of discovered peers or not.
     * @param peerId The peer ID.
     * @return True, if the peer is in the list. False otherwise.
     */
    private synchronized boolean peerDeviceListContainsPeer(String peerId) {
        boolean peerFound = false;

        for (PeerDeviceProperties peerDeviceProperties : mLastPeerDeviceList) {
            if (peerDeviceProperties != null && peerDeviceProperties.peerId.contentEquals(peerId)) {
                peerFound = true;
                break;
            }
        }

        return peerFound;
    }

    /**
     * Adds the peer with the given properties to the list of discovered peers, if not already in
     * there. If the peer was added, the Node layer is notified.
     * @param peerDeviceProperties The properties of the peer.
     * @return True, if added. False, if it already exists in the list.
     */
    private synchronized boolean addNewPeerToListAndNotify(PeerDeviceProperties peerDeviceProperties) {
        boolean peerAlreadyInTheList = peerDeviceListContainsPeer(peerDeviceProperties.peerId);

        // Instead of Wi-Fi Direct device address, use peer ID
        /*for (PeerDeviceProperties cachedPeerDeviceProperties : mLastPeerDeviceList) {
            if (cachedPeerDeviceProperties != null
                    && peerDeviceProperties.deviceAddress.equalsIgnoreCase(cachedPeerDeviceProperties.deviceAddress)) {
                wasPreviouslyAvailable = true;
                break;
            }
        }*/

        if (!peerAlreadyInTheList) {
            Log.i(TAG, "addNewPeerToListAndNotify: Adding peer with ID " + peerDeviceProperties.peerId);
            mLastPeerDeviceList.add(peerDeviceProperties);

            JSONArray jsonArray = new JSONArray();
            jsonArray.put(getAvailabilityStatus(peerDeviceProperties, true));
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, jsonArray.toString());
        }

        return !peerAlreadyInTheList;
    }

    /**
     * Adds the peer with the given properties to the list of discovered peers, if not already in
     * there. If the peer was added, the Node layer is notified.
     * @param bluetoothSocket The Bluetooth socket associated with the peer.
     * @param peerId The peer ID.
     * @param peerName The peer name.
     * @param peerBluetoothAddress The Bluetooth address of the peer.
     */
    private synchronized void addNewPeerToListAndNotify(
            BluetoothSocket bluetoothSocket,
            String peerId, String peerName, String peerBluetoothAddress) {

        String bluetoothAddress = peerBluetoothAddress;

        if (bluetoothSocket != null) {
            if (bluetoothSocket.getRemoteDevice() != null) {
                bluetoothAddress = bluetoothSocket.getRemoteDevice().getAddress();
            }
        }

        PeerDeviceProperties peerDeviceProperties =
                new PeerDeviceProperties(peerId, peerName, bluetoothAddress, "", "", "");

        addNewPeerToListAndNotify(peerDeviceProperties);
    }

    /**
     * Closes and removes an incoming connection thread with the given ID.
     * @param incomingThreadId The ID of the incoming connection thread.
     * @return True, if the thread was found, closed and removed.
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

        return wasFoundClosedAndRemoved;
    }

    /**
     * Closes and removes an outgoing connection with the given thread ID.
     * @param outgoingThreadId The ID of the outgoing connection thread.
     * @param notify If true, will notify the Node layer.
     * @return True, if the thread was found, closed and removed.
     */
    private synchronized boolean closeAndRemoveOutgoingConnectionThread(final long outgoingThreadId, boolean notify) {
        boolean wasFoundAndDisconnected = false;

        for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
            if (outgoingSocketThread != null && outgoingSocketThread.getId() == outgoingThreadId) {
                final String peerId = outgoingSocketThread.getPeerId();
                Log.i(TAG, "closeAndRemoveOutgoingConnectionThread: Closing connection, peer ID: " + peerId);
                mOutgoingConnectionListeners.remove(peerId);
                mOutgoingSocketThreads.remove(outgoingSocketThread);
                outgoingSocketThread.close();
                wasFoundAndDisconnected = true;

                if (notify) {
                    JSONObject jsonObject = new JSONObject();

                    try {
                        jsonObject.put(JXcoreExtension.EVENTVALUESTRING_PEERID, peerId);
                    } catch (JSONException e) {
                        Log.e(TAG, "closeAndRemoveOutgoingConnectionThread: Failed to construct a JSON object: " + e.getMessage(), e);
                    }

                    jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_CONNECTIONERROR, jsonObject.toString());
                }

                break;
            }
        }

        return wasFoundAndDisconnected;
    }

    /**
     * Disconnects all outgoing connections.
     */
    private synchronized void disconnectAllOutgoingConnections() {
        for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
            if (outgoingSocketThread != null) {
                Log.i(TAG, "disconnectAllOutgoingConnections: Disconnecting " + outgoingSocketThread.getName());
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
    public synchronized int disconnectAllIncomingConnections() {
        int numberOfConnectionsClosed = 0;

        for (IncomingSocketThread incomingSocketThread : mIncomingSocketThreads) {
            if (incomingSocketThread != null) {
                Log.i(TAG, "disconnectAllIncomingConnections: Disconnecting " + incomingSocketThread.getName());
                incomingSocketThread.close();
                numberOfConnectionsClosed++;
            }
        }

        mIncomingSocketThreads.clear();
        return numberOfConnectionsClosed;
    }

    /**
     *
     * @param peerDeviceProperties
     * @param available
     * @return
     */
    private JSONObject getAvailabilityStatus(PeerDeviceProperties peerDeviceProperties, boolean available) {
        JSONObject jsonObject = new JSONObject();

        try {
            jsonObject.put(JXcoreExtension.EVENTVALUESTRING_PEERID, peerDeviceProperties.peerId);
            jsonObject.put(JXcoreExtension.EVENTVALUESTRING_PEERNAME, peerDeviceProperties.peerName);
            jsonObject.put(JXcoreExtension.EVENTVALUESTRING_PEERAVAILABLE, available);
        } catch (JSONException e) {
            Log.e(TAG, "getAvailabilityStatus: Failed: " + e.getMessage(), e);
        }

        return jsonObject;
    }
}
