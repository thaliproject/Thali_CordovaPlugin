package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.os.Handler;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Created by juksilve on 4.6.2015.
 */
public class BtToRequestSocket extends Thread implements StreamCopyingThread.CopyThreadCallback {

    public static final int SOCKET_DISCONNEDTED  = 0x43;

    private Handler mHandler;

    private BluetoothSocket mmSocket = null;;
    private Socket localHostSocket = null;
    private ServerSocket srvSocket = null;

    private InputStream mmInStream = null;
    private OutputStream mmOutStream = null;
    private InputStream LocalInputStream = null;
    private OutputStream LocalOutputStream = null;

    private String mPeerId = "";
    private String mPeerName = "";
    private String mPeerAddress = "";

    private StreamCopyingThread SendingThread = null;
    private StreamCopyingThread ReceivingThread = null;

    private int mHTTPPort = 0;

    final String TAG  = "--BtCon-Req-Socket";

    boolean mStopped = false;

    public BtToRequestSocket(BluetoothSocket socket, Handler handler) {
        print_debug("Creating BtConnectedRequestSocket");
        mHandler = handler;
        mmSocket = socket;

        InputStream tmpIn = null;
        OutputStream tmpOut = null;

        // Get the BluetoothSocket input and output streams
        try {
            print_debug("Get BT input Streams");
            tmpIn = mmSocket.getInputStream();
            tmpOut = mmSocket.getOutputStream();
        } catch (Exception e) {
            print_debug("Creating temp sockets failed: " + e.toString());
        }
        mmInStream = tmpIn;
        mmOutStream = tmpOut;

    }

    public void setPort(int port){
        mHTTPPort = port;
    }

    public void run() {

        InputStream tmpInputStream = null;
        OutputStream tmpOutputStream = null;
        try {
            print_debug("start ServerSocket with port: " + mHTTPPort);
            srvSocket = new ServerSocket(mHTTPPort);
            mHTTPPort = srvSocket.getLocalPort();
            print_debug("mHTTPPort  set to : " + mHTTPPort);
        } catch (Exception e) {
            print_debug("Creating local sockets failed: " + e.toString());
        }

        while (!mStopped) {
            if (srvSocket != null) {
                try {
                    Socket tmpSocket = srvSocket.accept();
                    CloseSocketAndStreams();
                    localHostSocket = tmpSocket;

                    print_debug("incoming data from: " + GetLocalHostAddress() + ", port: " + GetLocalHostPort());
                    tmpInputStream = localHostSocket.getInputStream();
                    tmpOutputStream = localHostSocket.getOutputStream();

                } catch (Exception e) {
                    print_debug("Creating local sockets failed: " + e.toString());
                }

                print_debug("Set local streams");
                LocalInputStream = tmpInputStream;
                LocalOutputStream = tmpOutputStream;

                if (mmInStream != null && LocalInputStream != null
                 && mmOutStream != null && LocalOutputStream != null
                 && localHostSocket != null) {

                    if(SendingThread != null){
                        SendingThread.setStreams(LocalInputStream, mmOutStream);
                    }else {
                        SendingThread = new StreamCopyingThread(this,LocalInputStream, mmOutStream);
                        SendingThread.setDebugTag("--Sending");
                        SendingThread.start();
                    }
                    if(ReceivingThread != null){
                        ReceivingThread.setStreams(mmInStream, LocalOutputStream);
                    }else {
                        ReceivingThread = new StreamCopyingThread(this,mmInStream, LocalOutputStream);
                        ReceivingThread.setDebugTag("--Receiving");
                        ReceivingThread.start();
                    }
                    print_debug("Stream Threads are running");
                } else {
                    mStopped = true;
                    print_debug("at least one stream is null");
                    mHandler.obtainMessage(SOCKET_DISCONNEDTED, -1, -1, "at least one stream is null").sendToTarget();
                }
            } else {
                mStopped = true;
                print_debug("creating serve socket failed");
                mHandler.obtainMessage(SOCKET_DISCONNEDTED, -1, -1, "creating serve socket failed").sendToTarget();
            }
        }

        print_debug("rin ended ---------------------------;");
    }

    @Override
    public void StreamCopyError(StreamCopyingThread who, String error) {

        // Receiving Thread is the one that is having Bluetooth input stream,
        // thus if it gives error, we know that connection has been disconnected from other end.
        if(who == ReceivingThread){
            print_debug("ReceivingThread thread got error: " + error);
            mStopped = true;
            mHandler.obtainMessage(SOCKET_DISCONNEDTED, -1, -1, "creating serve socket failed").sendToTarget();
        }else if(who == SendingThread){
            print_debug("SendingThread thread got error: " + error);
        }else{
            print_debug("Dunno which thread got error: " + error);
        }
    }

    @Override
    public void StreamCopyStopped(StreamCopyingThread who, String message) {
        if(who == SendingThread){
            print_debug("SendingThread Stopped: " + message);
        }else if(who == ReceivingThread){
            print_debug("ReceivingThread Stopped: " + message);
        }else{
            print_debug("Dunno which thread Stopped: " + message);
        }
    }

    public int GetLocalHostPort() {
        return mHTTPPort;
    }

    public String GetLocalHostAddress() {
        String ret = "";
        if(localHostSocket != null && localHostSocket.getInetAddress() != null){
            ret = localHostSocket.getInetAddress().toString();
        }
        return ret;
    }

    public void Stop() {
        mStopped = true;

        if(ReceivingThread != null){
            print_debug("Stop ReceivingThread");
            ReceivingThread.Stop();
            ReceivingThread = null;
        }

        if(SendingThread != null){
            print_debug("Stop SendingThread");
            SendingThread.Stop();
            SendingThread = null;
        }

        CloseSocketAndStreams();

        if (mmInStream != null) {
            try {print_debug("Close bt in");
                mmInStream.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
            mmInStream = null;
        }

        if (mmOutStream != null) {
            try {print_debug("Close bt out");
                mmOutStream.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
            mmOutStream = null;
        }

        if (mmSocket != null) {
            try {print_debug("Close bt socket");
                mmSocket.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
            mmSocket = null;
        }

        if (srvSocket != null) {
            try {print_debug("Close server socket");
                srvSocket.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
            srvSocket = null;
        }
    }

    public void CloseSocketAndStreams() {
        if (LocalInputStream != null) {
            try {print_debug("Close local in");
                LocalInputStream.close();} catch (Exception e) {
                print_debug("Close error : " + e.toString());
            }
            LocalInputStream = null;
        }

        if (LocalOutputStream != null) {
            try {print_debug("Close localout");
                LocalOutputStream.close();} catch (Exception e) {
                print_debug("Close error : " + e.toString());
            }
            LocalOutputStream = null;
        }
        if (localHostSocket != null) {
            try {print_debug("Close local host sokcte");
                localHostSocket.close();} catch (Exception e) {
                print_debug("Close error : " + e.toString());
            }
            localHostSocket = null;
        }
    }
    public void SetIdAddressAndName(String peerId,String peerName,String peerAddress) {
        mPeerId = peerId;
        mPeerName = peerName;
        mPeerAddress = peerAddress;
    }
    public String GetPeerId() {
        return mPeerId;
    }
    public String GetPeerName(){
        return mPeerName;
    }
    public String GetPeerAddress(){
        return mPeerAddress;
    }

    public void print_debug(String message){
        Log.i(TAG, message);
    }

}
