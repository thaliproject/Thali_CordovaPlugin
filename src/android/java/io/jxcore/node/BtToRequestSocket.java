package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.os.Handler;
import android.util.Log;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Created by juksilve on 4.6.2015.
 */
public class BtToRequestSocket extends Thread implements StreamCopyingThread.CopyThreadCallback {

    BtToRequestSocket that = this;

    public interface ReadyForIncoming
    {
        void listeningAndAcceptingNow(int port);
    }
    private ReadyForIncoming readyCallback;
    private BtSocketDisconnectedCallBack mHandler;

    private BluetoothSocket mmSocket = null;
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

    final String TAG = "--BtCon-CLIENT-Socket";

    boolean mStopped = false;

    public BtToRequestSocket(BluetoothSocket socket, BtSocketDisconnectedCallBack handler,ReadyForIncoming callback) {
        print_debug("Creating BtConnectedRequestSocket");
        mHandler = handler;
        mmSocket = socket;
        readyCallback = callback;

        InputStream tmpIn = null;
        OutputStream tmpOut = null;

        // Get the BluetoothSocket input and output streams
        try {
            print_debug("Get BT input Streams");
            tmpIn = mmSocket.getInputStream();
            tmpOut = mmSocket.getOutputStream();
        } catch (Exception e) {
            mStopped = true;
            print_debug("Creating temp sockets  failed: " + e.toString());
            mHandler.Disconnected(that,"Creating temp sockets  failed");
        }
        mmInStream = tmpIn;
        mmOutStream = tmpOut;
    }

    public void setPort(int port) {
        mHTTPPort = port;
    }

    public void run() {
        try {
            print_debug("start Socket with port: " + mHTTPPort);
            srvSocket = new ServerSocket(mHTTPPort);
            mHTTPPort = srvSocket.getLocalPort();
            print_debug("mHTTPPort  set to : " + mHTTPPort);
        } catch (Exception e) {
            print_debug("Creating local sockets failed: " + e.toString());
            srvSocket = null;
        }

        InputStream tmpInputStream = null;
        OutputStream tmpOutputStream = null;

        if (srvSocket != null) {
            try {

                if(readyCallback != null){
                    readyCallback.listeningAndAcceptingNow(mHTTPPort);
                }
                print_debug("Now accepting connections");
                Socket tmpSocket = srvSocket.accept();
                CloseSocketAndStreams();
                localHostSocket = tmpSocket;

                print_debug("incoming data from: " + GetLocalHostAddress() + ", port: " + GetLocalHostPort());
                tmpInputStream = localHostSocket.getInputStream();
                tmpOutputStream = localHostSocket.getOutputStream();

            } catch (Exception e) {
                mStopped = true;
                print_debug("Creating local streams failed: " + e.toString());
                mHandler.Disconnected(that,"Creating local streams failed");
            }

            if(!mStopped) {
                print_debug("Set local streams");
                LocalInputStream = tmpInputStream;
                LocalOutputStream = tmpOutputStream;

                if (mmInStream != null && LocalInputStream != null
                 && mmOutStream != null && LocalOutputStream != null
                 && localHostSocket != null) {

                    SendingThread = new StreamCopyingThread(this, LocalInputStream, mmOutStream);
                    SendingThread.setDebugTag("--Sending");
                    SendingThread.start();

                    ReceivingThread = new StreamCopyingThread(this, mmInStream, LocalOutputStream);
                    ReceivingThread.setDebugTag("--Receiving");
                    ReceivingThread.start();

                    print_debug("Stream Threads are running");
                } else {
                    mStopped = true;
                    print_debug("at least one stream is null");
                    mHandler.Disconnected(that,"at least one stream is null");
                }
            }
        } else {
            mStopped = true;
            print_debug("creating  socket failed");
            mHandler.Disconnected(that,"creating socket failed");
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
            mHandler.Disconnected(that,"creating serve socket failed");
        }else if(who == SendingThread){
            //Sending socket has local input stream, thus if it is giving error we are getting local disconnection
            // thus we should do round to get new local connection
            print_debug("SendingThread thread got error: " + error);
            if(SendingThread != null){
                print_debug("Stop SendingThread");
                SendingThread.Stop();
                SendingThread = null;
            }
            mStopped = true;
            // with this app we want to disconnect the Bluetooth once we lose local sockets
            mHandler.Disconnected(that,error);

        }else{
            print_debug("Dunno which thread got error: " + error);
        }
    }

    public int GetLocalHostPort() {
        return mHTTPPort;
    }

    public String GetLocalHostAddress() {
        if(localHostSocket == null){
            return "";
        }

        if(localHostSocket.getInetAddress() == null){
            return "";
        }

        return localHostSocket.getInetAddress().toString();
    }

    public void Stop() {
        mStopped = true;

        StreamCopyingThread tmpSCTrec = ReceivingThread;
        ReceivingThread = null;
        if(tmpSCTrec != null){
            print_debug("Stop ReceivingThread");
            tmpSCTrec.Stop();
        }

        StreamCopyingThread tmpSCTsend = SendingThread;
        SendingThread = null;
        if(tmpSCTsend != null){
            print_debug("Stop SendingThread");
            tmpSCTsend.Stop();
        }

        CloseSocketAndStreams();

        InputStream tmpInStr = mmInStream;
        mmInStream = null;
        if (tmpInStr != null) {
            try {print_debug("Close bt in");
                tmpInStr.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
        }

        OutputStream tmpOutStr = mmOutStream;
        mmOutStream = null;
        if (tmpOutStr != null) {
            try {print_debug("Close bt out");
                tmpOutStr.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
        }

        BluetoothSocket tmpSoc = mmSocket;
        mmSocket = null;
        if (tmpSoc != null) {
            try {print_debug("Close bt socket");
                tmpSoc.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
        }

        ServerSocket tmpSrvSoc = srvSocket;
        srvSocket = null;
        if (tmpSrvSoc != null) {
            try {print_debug("Close server socket");
                tmpSrvSoc.close();} catch (Exception e) {print_debug("Close error : " + e.toString());}
        }
    }

    public void CloseSocketAndStreams() {

        InputStream tmpLocStrIn = LocalInputStream;
        LocalInputStream = null;
        if (tmpLocStrIn != null) {
            try {print_debug("Close local in");
                tmpLocStrIn.close();} catch (Exception e) {
                print_debug("Close error : " + e.toString());
            }
        }

        OutputStream tmpLocStrOut = LocalOutputStream;
        LocalOutputStream = null;
        if (tmpLocStrOut != null) {
            try {print_debug("Close localout");
                tmpLocStrOut.close();} catch (Exception e) {
                print_debug("Close error : " + e.toString());
            }
        }

        Socket tmpLHSoc = localHostSocket;
        localHostSocket = null;
        if (tmpLHSoc != null) {
            try {print_debug("Close local host sokcte");
                tmpLHSoc.close();} catch (Exception e) {
                print_debug("Close error : " + e.toString());
            }
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
        //Log.i(TAG, message);
    }

}
