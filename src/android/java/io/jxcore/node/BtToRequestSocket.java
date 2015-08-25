package io.jxcore.node;

import android.bluetooth.BluetoothSocket;

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
        print_debug("BtToRequestSocket", "Creating BtConnectedRequestSocket");
        readyCallback = callback;
    }

    public void run() {

        try {
            srvSocket = new ServerSocket(0);
            print_debug("BtToRequestSocket", "mHTTPPort  set to : " + srvSocket.getLocalPort());
        } catch (Exception e) {
            print_debug("BtToRequestSocket", "Creating local sockets failed: " + e.toString());
            srvSocket = null;
            mStopped = true;
            mHandler.Disconnected(that, "creating socket failed");
            return;
        }

        InputStream tmpInputStream = null;
        OutputStream tmpOutputStream = null;

        try {
            if (readyCallback != null) {
                readyCallback.listeningAndAcceptingNow(srvSocket.getLocalPort());
            }
            print_debug("BtToRequestSocket", "Now accepting connections");
            Socket tmpSocket = srvSocket.accept();
            CloseSocketAndStreams();
            localHostSocket = tmpSocket;

            print_debug("BtToRequestSocket", "incoming data from: " + GetLocalHostAddressAsString() + ", port: " + GetLocalHostPort());
            tmpInputStream = localHostSocket.getInputStream();
            tmpOutputStream = localHostSocket.getOutputStream();

        } catch (Exception e) {
            mStopped = true;
            print_debug("BtToRequestSocket", "Creating local streams failed: " + e.toString());
            mHandler.Disconnected(that, "Creating local streams failed");
            return;
        }

        print_debug("BtToRequestSocket", "Set local streams");
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

        print_debug("BtToRequestSocket", "rin ended ---------------------------;");
    }

    private  int GetLocalHostPort() {
        return srvSocket == null ? 0 : srvSocket.getLocalPort();
    }

    public void Stop() {
        super.Stop();

        ServerSocket tmpSrvSoc = srvSocket;
        srvSocket = null;
        if (tmpSrvSoc != null) {
            try {print_debug("BtToRequestSocket", "Close server socket");
                tmpSrvSoc.close();} catch (Exception e) {print_debug("BtToRequestSocket", "Close error : " + e.toString());}
        }
    }

}
