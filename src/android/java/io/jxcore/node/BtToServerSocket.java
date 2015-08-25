package io.jxcore.node;

import android.bluetooth.BluetoothSocket;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.Socket;

/**
 * Created by juksilve on 15.5.2015.
 */
class BtToServerSocket extends BtToSocketBase {

    private int mHTTPPort = 0;

    public BtToServerSocket(BluetoothSocket socket, BtSocketDisconnectedCallBack handler) throws IOException{
        super(socket,handler);
        print_debug("BtToRequestSocket", "Creating BTConnectedThread");
    }

    public void setPort(int port){
        mHTTPPort = port;
    }

    public void run() {

        print_debug("BtToRequestSocket", "--DoOneRunRound started");

        InputStream tmpInputStream = null;
        OutputStream tmpOutputStream = null;
        try {
            Inet4Address mLocalHostAddress = (Inet4Address) Inet4Address.getByName("localhost");
            localHostSocket = new Socket(mLocalHostAddress, mHTTPPort);

            print_debug("BtToRequestSocket", "LocalHost address: " + GetLocalHostAddressAsString() + ", port: " + GetLocalHostPort());

            tmpInputStream = localHostSocket.getInputStream();
            tmpOutputStream = localHostSocket.getOutputStream();

        } catch (Exception e) {
            print_debug("BtToRequestSocket", "Creating local input streams failed: " + e.toString());
            mStopped = true;
            mHandler.Disconnected(that, "creating local input streams failed");
            return;
        }

        LocalInputStream = tmpInputStream;
        LocalOutputStream = tmpOutputStream;

        if (mmInStream == null || LocalInputStream == null || mmOutStream == null || LocalOutputStream == null || localHostSocket == null) {
            mStopped = true;
            print_debug("BtToRequestSocket", "at least one stream is null");
            mHandler.Disconnected(that, "at least one stream is null");
            return;
        }

        SendingThread = new StreamCopyingThread(this, LocalInputStream, mmOutStream);
        SendingThread.setDebugTag("--Sending");
        SendingThread.start();

        ReceivingThread = new StreamCopyingThread(this, mmInStream, LocalOutputStream);
        ReceivingThread.setDebugTag("--Receiving");
        ReceivingThread.start();

        print_debug("BtToRequestSocket", "--DoOneRunRound ended");
    }

    public int GetLocalHostPort() {
        return localHostSocket == null ? 0 : localHostSocket.getPort();
    }
}
