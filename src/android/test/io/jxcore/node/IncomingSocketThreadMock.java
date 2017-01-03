package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.Socket;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

public class IncomingSocketThreadMock extends IncomingSocketThread {
    Long threadId = 4321L;
    int port;
    boolean closeCalled = false;
    InputStream tempInputStream = null;
    OutputStream tempOutputStream = null;
    boolean localStreamsCreatedSuccessfully = false;

    public IncomingSocketThreadMock(BluetoothSocket bluetoothSocket, Listener listener,
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
            Inet4Address mLocalHostAddress = (Inet4Address) Inet4Address.getByName("localhost");

            mLocalhostSocket = new Socket(mLocalHostAddress, port);

            Log.i(mTag, "Local host address: " + getLocalHostAddressAsString() + ", port: " +
                    getLocalHostPort());

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

            startStreamCopyingThreads(new ConnectionData(
                new PeerProperties(PeerProperties.BLUETOOTH_MAC_ADDRESS_UNKNOWN), true));
        }
    }
}
