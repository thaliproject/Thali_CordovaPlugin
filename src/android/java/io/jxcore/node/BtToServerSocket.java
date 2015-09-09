package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;

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
        Log.i("BtToRequestSocket", "Creating BTConnectedThread");
    }

    public void setPort(int port){
        mHTTPPort = port;
    }

    public void run() {

        Log.i("BtToRequestSocket", "--DoOneRunRound started");

        InputStream tmpInputStream = null;
        OutputStream tmpOutputStream = null;
        try {
            Inet4Address mLocalHostAddress = (Inet4Address) Inet4Address.getByName("localhost");
            localHostSocket = new Socket(mLocalHostAddress, mHTTPPort);

            Log.i("BtToRequestSocket", "LocalHost address: " + GetLocalHostAddressAsString() + ", port: " + GetLocalHostPort());

            tmpInputStream = localHostSocket.getInputStream();
            tmpOutputStream = localHostSocket.getOutputStream();

        } catch (IOException e) {
            Log.i("BtToRequestSocket", "Creating local input streams failed: " + e.toString());
            mHandler.Disconnected(that, "creating local input streams failed");
            return;
        }

        LocalInputStream = tmpInputStream;
        LocalOutputStream = tmpOutputStream;

        StartStreamCopyThreads();

        Log.i("BtToRequestSocket", "--DoOneRunRound ended");
    }

    public int GetLocalHostPort() {
        return localHostSocket == null ? 0 : localHostSocket.getPort();
    }
}
