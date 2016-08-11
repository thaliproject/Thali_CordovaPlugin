/* Copyright (c) 2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.util.Log;

import java.util.HashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * A model for keeping track of the established connections.
 */
public class ConnectionModel {
    private static final String TAG = ConnectionModel.class.getName();
    private final CopyOnWriteArrayList<IncomingSocketThread> mIncomingSocketThreads = new CopyOnWriteArrayList<IncomingSocketThread>();
    private final CopyOnWriteArrayList<OutgoingSocketThread> mOutgoingSocketThreads = new CopyOnWriteArrayList<OutgoingSocketThread>();
    private final HashMap<String, JXcoreThaliCallback> mOutgoingConnectionCallbacks = new HashMap<String, JXcoreThaliCallback>();

    /**
     * Constructor.
     */
    public ConnectionModel() {
    }

    /**
     * Checks if we have an incoming connection with a peer matching the given peer ID.
     *
     * @param peerId The peer ID.
     * @return True, if connected. False otherwise.
     */
    public synchronized boolean hasIncomingConnection(final String peerId) {
        return (findSocketThread(peerId, true) != null);
    }

    /**
     * Checks if we have an outgoing connection with a peer matching the given peer ID.
     *
     * @param peerId The peer ID.
     * @return True, if connected. False otherwise.
     */
    public synchronized boolean hasOutgoingConnection(final String peerId) {
        return (findSocketThread(peerId, false) != null);
    }

    /**
     * Checks if we have either an incoming or outgoing connection with a peer matching the given ID.
     *
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

        if (!hasIncoming && !hasOutgoing) {
            Log.d(TAG, "hasConnection: No connection with peer with ID " + peerId);
        }

        return (hasIncoming || hasOutgoing);
    }

    /**
     * @return The sum of currently established incoming and outgoing connections.
     */
    public int getNumberOfCurrentConnections() {
        return (getNumberOfCurrentIncomingConnections() + getNumberOfCurrentOutgoingConnections());
    }

    /**
     * @return The number of currently established incoming connections.
     */
    public int getNumberOfCurrentIncomingConnections() {
        return mIncomingSocketThreads.size();
    }

    /**
     * @return The number of currently established outgoing connections.
     */
    public int getNumberOfCurrentOutgoingConnections() {
        return mOutgoingSocketThreads.size();
    }

    /**
     * @param bluetoothMacAddress The Bluetooth MAC address of an outgoing connection.
     * @return A callback instance associated with the given Bluetooth MAC address.
     */
    public synchronized JXcoreThaliCallback getOutgoingConnectionCallbackByBluetoothMacAddress(String bluetoothMacAddress) {
        return mOutgoingConnectionCallbacks.get(bluetoothMacAddress);
    }

    /**
     * Adds the given callback for a connection with the given Bluetooth MAC address.
     *
     * @param bluetoothMacAddress The Bluetooth MAC address.
     * @param callback            The callback associated with the connection.
     * @return True, if added. False otherwise (e.g. already added).
     */
    public synchronized boolean addOutgoingConnectionCallback(
            String bluetoothMacAddress, JXcoreThaliCallback callback) {
        boolean wasAdded = false;

        if (bluetoothMacAddress != null && callback != null) {
            boolean alreadyExists = false;

            for (HashMap.Entry<String, JXcoreThaliCallback> entry : mOutgoingConnectionCallbacks.entrySet()) {
                if (entry.getKey().equals(bluetoothMacAddress)) {
                    alreadyExists = true;
                    break;
                }
            }

            if (!alreadyExists) {
                wasAdded = true;
                mOutgoingConnectionCallbacks.put(bluetoothMacAddress, callback);
            }
        }

        return wasAdded;
    }

    /**
     * Removes the callback associated with the given Bluetooth MAC address.
     *
     * @param bluetoothMacAddress The Bluetooth MAC address of an outgoing connection.
     */
    public synchronized void removeOutgoingConnectionCallback(String bluetoothMacAddress) {
        if (mOutgoingConnectionCallbacks.remove(bluetoothMacAddress) != null) {
            Log.d(TAG, "removeOutgoingConnectionCallback: Callback associated with Bluetooth MAC address \"" + bluetoothMacAddress + "\" removed");
        } else {
            Log.e(TAG, "removeOutgoingConnectionCallback: Callback associated with Bluetooth MAC address \"" + bluetoothMacAddress + "\" not found");
        }
    }

    /**
     * Adds the given connection thread to the collection.
     *
     * @param incomingSocketThread An incoming (connection) socket thread instance to add.
     * @return True, if the thread was successfully added to the collection. False otherwise.
     */
    public synchronized boolean addConnectionThread(IncomingSocketThread incomingSocketThread) {
        if (!mIncomingSocketThreads.addIfAbsent(incomingSocketThread)) {
            Log.e(TAG, "addConnectionThread: A matching thread for incoming connection already exists");
            return false;
        }

        return true;
    }

    /**
     * Adds the given connection thread to the collection.
     *
     * @param outgoingSocketThread An outgoing (connection) socket thread instance to add.
     * @return True, if the thread was successfully added to the collection. False otherwise.
     */
    public synchronized boolean addConnectionThread(OutgoingSocketThread outgoingSocketThread) {
        if (!mOutgoingSocketThreads.addIfAbsent(outgoingSocketThread)) {
            Log.e(TAG, "addConnectionThread: A matching thread for outgoing connection already exists");
            return false;
        }

        return true;
    }

    /**
     * Closes and removes an incoming connection thread with the given ID.
     *
     * @param incomingThreadId The ID of the incoming connection thread.
     * @return True, if the thread was found, the connection was closed and the thread was removed from the list.
     */
    public synchronized boolean closeAndRemoveIncomingConnectionThread(final long incomingThreadId) {
        boolean wasFoundAndClosed = false;

        for (IncomingSocketThread incomingSocketThread : mIncomingSocketThreads) {
            if (incomingSocketThread != null && incomingSocketThread.getId() == incomingThreadId) {
                Log.i(TAG, "closeAndRemoveIncomingConnectionThread: Closing and removing incoming connection thread with ID " + incomingThreadId);
                mIncomingSocketThreads.remove(incomingSocketThread);
                incomingSocketThread.close();
                wasFoundAndClosed = true;
                break;
            }
        }

        if (!wasFoundAndClosed) {
            Log.e(TAG, "closeAndRemoveIncomingConnectionThread: Failed to find an incoming connection thread with ID " + incomingThreadId);
        }

        Log.d(TAG, "closeAndRemoveIncomingConnectionThread: " + mIncomingSocketThreads.size() + " incoming connection(s) left");
        return wasFoundAndClosed;
    }

    /**
     * Closes and removes an outgoing connection with the given peer ID.
     *
     * @param peerId The ID of the peer to disconnect.
     * @return True, if the thread was found, the connection was closed and the thread was removed from the list.
     */
    public synchronized boolean closeAndRemoveOutgoingConnectionThread(final String peerId) {
        boolean wasFoundAndClosed = false;
        OutgoingSocketThread outgoingSocketThread = (OutgoingSocketThread) findSocketThread(peerId, false);

        if (outgoingSocketThread != null) {
            Log.i(TAG, "closeAndRemoveOutgoingConnectionThread: Closing connection, peer ID: " + peerId);
            mOutgoingConnectionCallbacks.remove(peerId);
            mOutgoingSocketThreads.remove(outgoingSocketThread);
            outgoingSocketThread.close();
            wasFoundAndClosed = true;
        }

        if (!wasFoundAndClosed) {
            Log.e(TAG, "closeAndRemoveOutgoingConnectionThread: Failed to find an outgoing connection to peer with ID " + peerId);
        }

        Log.d(TAG, "closeAndRemoveOutgoingConnectionThread: " + mOutgoingSocketThreads.size() + " outgoing connection(s) left");
        return wasFoundAndClosed;
    }

    /**
     * Disconnects all outgoing connections.
     */
    public synchronized void closeAndRemoveAllOutgoingConnections() {
        for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
            if (outgoingSocketThread != null) {
                Log.d(TAG, "closeAndRemoveAllOutgoingConnections: Peer: " + outgoingSocketThread.getPeerProperties().toString());
                outgoingSocketThread.close();
            }
        }

        mOutgoingSocketThreads.clear();
        mOutgoingConnectionCallbacks.clear();
    }

    /**
     * Disconnects all incoming connections.
     * This method should only be used internally and should, in the future, be made private.
     * For now, this method can be used for testing to emulate 'peer disconnecting' events.
     *
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
     * Tries to find a socket thread with the given peer ID.
     *
     * @param peerId     The peer ID associated with the socket thread.
     * @param isIncoming If true, will search from incoming connections. If false, will search from outgoing connections.
     * @return The socket thread or null if not found.
     */
    private synchronized SocketThreadBase findSocketThread(final String peerId, final boolean isIncoming) {
        SocketThreadBase foundThread = null;

        if (isIncoming) {
            for (IncomingSocketThread incomingSocketThread : mIncomingSocketThreads) {
                if (incomingSocketThread != null && incomingSocketThread.getPeerProperties().getId().equalsIgnoreCase(peerId)) {
                    foundThread = incomingSocketThread;
                    break;
                }
            }
        } else {
            for (OutgoingSocketThread outgoingSocketThread : mOutgoingSocketThreads) {
                if (outgoingSocketThread != null && outgoingSocketThread.getPeerProperties().getId().equalsIgnoreCase(peerId)) {
                    foundThread = outgoingSocketThread;
                    break;
                }
            }
        }

        return foundThread;
    }
}
