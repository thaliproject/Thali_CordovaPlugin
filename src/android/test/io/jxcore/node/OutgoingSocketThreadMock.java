package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

public class OutgoingSocketThreadMock extends OutgoingSocketThread {
    Long threadId = 1234L;
    int port;
    boolean closeCalled = false;
    InputStream tempInputStream = null;
    OutputStream tempOutputStream = null;
    boolean localStreamsCreatedSuccessfully = false;
    ServerSocket mServerSocket = null;
    int mListeningOnPortNumber = ConnectionHelper.NO_PORT_NUMBER;

    public OutgoingSocketThreadMock(BluetoothSocket bluetoothSocket, Listener listener,
                                    InputStream inputStream, OutputStream outputStream)
            throws IOException {
        super(bluetoothSocket, listener, inputStream, outputStream);
    }

    public void setPort(int _port){
        port = _port;
    }

    @Override
    public void close() {
        closeCalled = true;
    }

    @Override
    public long getId() {
        return threadId;
    }

    @Override
    public void run() {
        mIsClosing = false;

        try {
            mServerSocket = new ServerSocket(port);
            Log.d(mTag, "Server socket local port: " + mServerSocket.getLocalPort());
        } catch (IOException e) {
            Log.e(mTag, "Failed to create a server socket instance: " + e.getMessage(), e);
            mServerSocket = null;
            mListener.onDisconnected(this, "Failed to create a server socket instance: " +
                    e.getMessage());
        }

        if (mServerSocket != null) {
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

                startStreamCopyingThreads(new ConnectionData(
                    new PeerProperties(PeerProperties.BLUETOOTH_MAC_ADDRESS_UNKNOWN), false));
            }
        }
    }
}


