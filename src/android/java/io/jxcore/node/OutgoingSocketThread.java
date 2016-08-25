/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;

/**
 * A thread for outgoing Bluetooth connections.
 */
class OutgoingSocketThread extends SocketThreadBase {
    private ServerSocket mServerSocket = null;
    private int mListeningOnPortNumber = ConnectionHelper.NO_PORT_NUMBER;

    /**
     * Constructor for test purposes.
     *
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener        The listener.
     * @throws IOException Thrown, if the constructor of the base class, SocketThreadBase, fails.
     */
    public OutgoingSocketThread(BluetoothSocket bluetoothSocket, Listener listener)
            throws IOException {
        super(bluetoothSocket, listener);
        mTag = OutgoingSocketThread.class.getName();
    }

    /**
     * Constructor.
     *
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener        The listener.
     * @param inputStream     The InputStream.
     * @param outputStream    The OutputStream.
     * @throws IOException Thrown, if the constructor of the base class, SocketThreadBase, fails.
     */
    public OutgoingSocketThread(BluetoothSocket bluetoothSocket, Listener listener,
                                InputStream inputStream, OutputStream outputStream)
            throws IOException {
        super(bluetoothSocket, listener, inputStream, outputStream);
        mTag = OutgoingSocketThread.class.getName();
    }

    public int getListeningOnPortNumber() {
        return mListeningOnPortNumber;
    }

    /**
     * From Thread.
     */
    @Override
    public void run() {
        Log.d(mTag, "Entering thread (ID: " + getId() + ")");
        mIsClosing = false;

        try {
            mServerSocket = new ServerSocket(0);
            Log.d(mTag, "Server socket local port: " + mServerSocket.getLocalPort());
        } catch (IOException e) {
            Log.e(mTag, "Failed to create a server socket instance: " + e.getMessage(), e);
            mServerSocket = null;
            mListener.onDisconnected(this, "Failed to create a server socket instance: " + e.getMessage());
        }

        if (mServerSocket != null) {
            InputStream tempInputStream = null;
            OutputStream tempOutputStream = null;
            boolean localStreamsCreatedSuccessfully = false;

            try {
                Log.i(mTag, "Now accepting connections...");

                if (mListener != null) {
                    mListeningOnPortNumber = mServerSocket.getLocalPort();
                    mListener.onListeningForIncomingConnections(mListeningOnPortNumber);
                }

                mLocalhostSocket = mServerSocket.accept(); // Blocking call

                Log.i(mTag, "Incoming data from address: " + getLocalHostAddressAsString()
                        + ", port: " + mServerSocket.getLocalPort());

                tempInputStream = mLocalhostSocket.getInputStream();
                tempOutputStream = mLocalhostSocket.getOutputStream();
                localStreamsCreatedSuccessfully = true;
            } catch (IOException e) {
                if (!mIsClosing) {
                    String errorMessage =  "Failed to create local streams: " + e.getMessage();
                    Log.e(mTag, errorMessage, e);
                    mListener.onDisconnected(this, errorMessage);
                }
            }

            if (localStreamsCreatedSuccessfully) {
                Log.d(mTag, "Setting local streams and starting stream copying threads...");
                mLocalInputStream = tempInputStream;
                mLocalOutputStream = tempOutputStream;
                startStreamCopyingThreads();
            }
        }

        if (mServerSocket != null) {
            try {
                mServerSocket.close();
            } catch (IOException e) {
                Log.e(mTag, "Failed to close the server socket: " + e.getMessage(), e);
            }

            mServerSocket = null;
        }

        Log.d(mTag, "Exiting thread (ID: " + getId() + ")");
    }

    /**
     * Closes all the streams and sockets.
     */
    public synchronized void close() {
        Log.i(mTag, "close (thread ID: " + getId() + ")");
        super.close();

        if (mServerSocket != null) {
            try {
                mServerSocket.close();
            } catch (IOException e) {
                Log.e(mTag, "Failed to close the server socket: " + e.getMessage(), e);
            }

            mServerSocket = null;
        }
    }
}
