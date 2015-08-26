package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Created by juksilve on 4.6.2015.
 */
public class BtToRequestSocket extends BtToSocketBase{

    public interface ReadyForIncoming
    {
        void listeningAndAcceptingNow(int port);
    }
    private final ReadyForIncoming readyCallback;
    private ServerSocket srvSocket = null;

    public BtToRequestSocket(BluetoothSocket socket, BtSocketDisconnectedCallBack handler,ReadyForIncoming callback)  throws IOException {
        super(socket,handler);
        Log.i("BtToRequestSocket", "Creating BtConnectedRequestSocket");
        readyCallback = callback;
    }

    public void run() {

        try {
            srvSocket = new ServerSocket(0);
            Log.i("BtToRequestSocket", "mHTTPPort  set to : " + srvSocket.getLocalPort());
        } catch (IOException e) {
            Log.i("BtToRequestSocket", "Creating local sockets failed: " + e.toString());
            srvSocket = null;
            mHandler.Disconnected(that, "creating socket failed");
            return;
        }

        InputStream tmpInputStream = null;
        OutputStream tmpOutputStream = null;

        try {
            if (readyCallback != null) {
                readyCallback.listeningAndAcceptingNow(srvSocket.getLocalPort());
            }
            Log.i("BtToRequestSocket", "Now accepting connections");
            Socket tmpSocket = srvSocket.accept();
            CloseSocketAndStreams();
            localHostSocket = tmpSocket;

            Log.i("BtToRequestSocket", "incoming data from: " + GetLocalHostAddressAsString() + ", port: " + GetLocalHostPort());
            tmpInputStream = localHostSocket.getInputStream();
            tmpOutputStream = localHostSocket.getOutputStream();

        } catch (IOException e) {
            Log.i("BtToRequestSocket", "Creating local streams failed: " + e.toString());
            mHandler.Disconnected(that, "Creating local streams failed");
            return;
        }

        Log.i("BtToRequestSocket", "Set local streams");
        LocalInputStream = tmpInputStream;
        LocalOutputStream = tmpOutputStream;

        StartStreamCopyThreads();

        Log.i("BtToRequestSocket", "rin ended ---------------------------;");
    }

    private  int GetLocalHostPort() {
        return srvSocket == null ? 0 : srvSocket.getLocalPort();
    }

    public void Stop() {
        super.Stop();

        ServerSocket tmpSrvSoc = srvSocket;
        srvSocket = null;
        if (tmpSrvSoc != null) {
            try {Log.i("BtToRequestSocket", "Close server socket");
                tmpSrvSoc.close();} catch (IOException e) {Log.i("BtToRequestSocket", "Close error : " + e.toString());}
        }
    }
}
