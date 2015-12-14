/* Copyright (c) 2015 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.Socket;

/**
 * A thread for incoming Bluetooth connections.
 */
class IncomingSocketThread extends SocketThreadBase {
    private int mHttpPort = 0;

    /**
     * Constructor.
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener The listener.
     * @throws IOException Thrown, if the constructor of the base class, SocketThreadBase, fails.
     */
    public IncomingSocketThread(BluetoothSocket bluetoothSocket, ConnectionStatusListener listener)
            throws IOException{
        super(bluetoothSocket, listener);
        TAG = IncomingSocketThread.class.getName();
    }

    public void setHttpPort(int httpPort) {
        mHttpPort = httpPort;
    }

    public int getLocalHostPort() {
        return mLocalhostSocket == null ? 0 : mLocalhostSocket.getPort();
    }

    /**
     * From Thread.
     */
    @Override
    public void run() {
        Log.d(TAG, "Entering thread (ID: " + getId() + ")");
        InputStream tempInputStream = null;
        OutputStream tempOutputStream = null;
        boolean localStreamsCreatedSuccessfully = false;

        try {
            Inet4Address mLocalHostAddress = (Inet4Address) Inet4Address.getByName("localhost");
            mLocalhostSocket = new Socket(mLocalHostAddress, mHttpPort);

            Log.i(TAG, "Local host address: " + getLocalHostAddressAsString() + ", port: " + getLocalHostPort());

            tempInputStream = mLocalhostSocket.getInputStream();
            tempOutputStream = mLocalhostSocket.getOutputStream();
            localStreamsCreatedSuccessfully = true;
        } catch (IOException e) {
            Log.e(TAG, "Failed to create the local streams: " + e.getMessage(), e);
            mListener.onDisconnected(this, "Failed to create the local streams: " + e.getMessage());
        }

        if (localStreamsCreatedSuccessfully) {
            Log.d(TAG, "Setting local streams and starting stream copying threads...");
            mLocalInputStream = tempInputStream;
            mLocalOutputStream = tempOutputStream;
            startStreamCopyingThreads();
        }

        Log.d(TAG, "Exiting thread (ID: " + getId() + ")");
    }
}
