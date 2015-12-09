package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.os.Handler;
import android.util.Log;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * A thread for outgoing Bluetooth connections.
 */
class OutgoingSocketThread extends SocketThreadBase {
    // As a precaution we do a delayed notification (ConnectionStatusListener.onListeningForIncomingConnections)
    // to make sure that ServerSocket.accept() is run.
    private static final long LISTENING_FOR_CONNECTIONS_NOTIFICATION_DELAY_IN_MILLISECONDS = 300;

    private ServerSocket mServerSocket = null;

    /**
     * Constructor.
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener The listener.
     * @throws IOException Thrown, if the constructor of the base class, SocketThreadBase, fails.
     */
    public OutgoingSocketThread(BluetoothSocket bluetoothSocket, ConnectionStatusListener listener)
            throws IOException {
        super(bluetoothSocket, listener);
        TAG = OutgoingSocketThread.class.getName();
    }

    /**
     * From Thread.
     */
    @Override
    public void run() {
        Log.d(TAG, "Entering thread (ID: " + getId() + ")");

        try {
            mServerSocket = new ServerSocket(0);
            Log.d(TAG, "Server socket local port: " + mServerSocket.getLocalPort());
        } catch (IOException e) {
            Log.e(TAG, "Failed to create a server socket instance: " + e.getMessage(), e);
            mServerSocket = null;
            mListener.onDisconnected(this, "Failed to create a server socket instance: " + e.getMessage());
        }

        if (mServerSocket != null) {
            InputStream tempInputStream = null;
            OutputStream tempOutputStream = null;
            boolean localStreamsCreatedSuccessfully = false;

            try {
                Log.i(TAG, "Now accepting connections...");

                if (mListener != null) {
                    final ConnectionStatusListener listener = mListener;
                    final int localPort = mServerSocket.getLocalPort();
                    final Handler handler = new Handler(jxcore.activity.getMainLooper());

                    handler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            listener.onListeningForIncomingConnections(localPort);
                        }
                    }, LISTENING_FOR_CONNECTIONS_NOTIFICATION_DELAY_IN_MILLISECONDS);
                }

                Socket tempSocket = mServerSocket.accept(); // Blocking call

                mLocalhostSocket = tempSocket;

                Log.i(TAG, "Incoming data from address: " + getLocalHostAddressAsString()
                        + ", port: " + mServerSocket.getLocalPort());

                tempInputStream = mLocalhostSocket.getInputStream();
                tempOutputStream = mLocalhostSocket.getOutputStream();
                localStreamsCreatedSuccessfully = true;
            } catch (IOException e) {
                Log.e(TAG, "Failed to create local streams: " + e.getMessage(), e);
                mListener.onDisconnected(this, "Failed to create local streams: " + e.getMessage());
            }

            if (localStreamsCreatedSuccessfully) {
                Log.d(TAG, "Setting local streams and starting stream copying threads...");
                mLocalInputStream = tempInputStream;
                mLocalOutputStream = tempOutputStream;
                startStreamCopyingThreads();
            }
        }

        Log.d(TAG, "Exiting thread (ID: " + getId() + ")");
    }

    /**
     * Closes all the streams and sockets.
     */
    public synchronized void close() {
        Log.i(TAG, "close");
        super.close();

        if (mServerSocket != null) {
            try {
                mServerSocket.close();
            } catch (IOException e) {
                Log.e(TAG, "Failed to close the server socket: " + e.getMessage(), e);
            }

            mServerSocket = null;
        }
    }
}
