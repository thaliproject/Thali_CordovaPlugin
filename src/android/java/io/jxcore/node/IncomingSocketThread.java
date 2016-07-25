/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
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
    private int mTcpPortNumber = 0;

    /**
     * Constructor for test purposes.
     *
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener        The listener.
     * @throws IOException Thrown, if the constructor of the base class, SocketThreadBase, fails.
     */
    public IncomingSocketThread(BluetoothSocket bluetoothSocket, Listener listener)
            throws IOException {
        super(bluetoothSocket, listener);
        mTag = IncomingSocketThread.class.getName();
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
    public IncomingSocketThread(BluetoothSocket bluetoothSocket, Listener listener,
                                InputStream inputStream, OutputStream outputStream)
            throws IOException {
        super(bluetoothSocket, listener, inputStream, outputStream);
        mTag = IncomingSocketThread.class.getName();
    }

    public int getLocalHostPort() {
        Socket copyOfLocalHostSocket = mLocalhostSocket;
        return copyOfLocalHostSocket == null ? ConnectionHelper.NO_PORT_NUMBER : copyOfLocalHostSocket.getPort();
    }

    public int getTcpPortNumber() {
        return mTcpPortNumber;
    }
    
    public void setTcpPortNumber(int portNumber) {
        mTcpPortNumber = portNumber;
    }

    /**
     * From Thread.
     */
    @Override
    public void run() {
        Log.d(mTag, "Entering thread (ID: " + getId() + ")");
        mIsClosing = false;
        InputStream tempInputStream = null;
        OutputStream tempOutputStream = null;
        boolean localStreamsCreatedSuccessfully = false;

        try {
            Inet4Address mLocalHostAddress = (Inet4Address) Inet4Address.getByName("localhost");
            mLocalhostSocket = new Socket(mLocalHostAddress, mTcpPortNumber);

            Log.i(mTag, "Local host address: " + getLocalHostAddressAsString() + ", port: " + getLocalHostPort());

            tempInputStream = mLocalhostSocket.getInputStream();
            tempOutputStream = mLocalhostSocket.getOutputStream();
            localStreamsCreatedSuccessfully = true;
        } catch (IOException e) {
            Log.e(mTag, "Failed to create the local streams: " + e.getMessage(), e);
            mListener.onDisconnected(this, "Failed to create the local streams: " + e.getMessage());
        }

        if (localStreamsCreatedSuccessfully) {
            Log.d(mTag, "Setting local streams and starting stream copying threads...");
            mLocalInputStream = tempInputStream;
            mLocalOutputStream = tempOutputStream;
            startStreamCopyingThreads();
        }

        Log.d(mTag, "Exiting thread (ID: " + getId() + ")");
    }
}
