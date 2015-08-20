package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.Socket;

/**
 * Created by juksilve on 15.5.2015.
 */
public class BtToServerSocket extends Thread implements StreamCopyingThread.CopyThreadCallback {

    private final BtToServerSocket that = this;
    private BluetoothSocket mmSocket = null;
    private Socket localHostSocket = null;

    private InputStream mmInStream = null;
    private OutputStream mmOutStream = null;
    private InputStream LocalInputStream = null;
    private OutputStream LocalOutputStream = null;
    private final BtSocketDisconnectedCallBack mHandler;
    private String mPeerId = "";
    private String mPeerName = "";
    private String mPeerAddress = "";

    private StreamCopyingThread SendingThread = null;
    private StreamCopyingThread ReceivingThread = null;

    private int mHTTPPort = 0;

    private boolean mStopped = false;

    public BtToServerSocket(BluetoothSocket socket, BtSocketDisconnectedCallBack handler) {
        print_debug("Creating BTConnectedThread");
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
            print_debug("Creating Bluetooth input streams failed: " + e.toString());
            mStopped = true;
            mHandler.Disconnected(that,"creating Bluetooth input streams failed");
        }
        mmInStream = tmpIn;
        mmOutStream = tmpOut;

    }
    public void setPort(int port){
        mHTTPPort = port;
    }

    public void run() {

        print_debug("--DoOneRunRound started");
        InputStream tmpInputStream = null;
        OutputStream tmpOutputStream = null;
        try {
            Inet4Address mLocalHostAddress = (Inet4Address) Inet4Address.getByName("localhost");
            localHostSocket = new Socket(mLocalHostAddress, mHTTPPort);

            mHTTPPort = localHostSocket.getPort();

            print_debug("LocalHost address: " + GetLocalHostAddressAsString() + ", port: " + GetLocalHostPort());

            tmpInputStream = localHostSocket.getInputStream();
            tmpOutputStream = localHostSocket.getOutputStream();

        } catch (Exception e) {
            print_debug("Creating local input streams failed: " + e.toString());
            mStopped = true;
            mHandler.Disconnected(that,"creating local input streams failed");
        }
        if(!mStopped) {
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

        print_debug("--DoOneRunRound ended");
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
            StreamCopyingThread tmpSendThread = SendingThread;
            SendingThread = null;
            if(tmpSendThread != null){
                print_debug("Stop SendingThread");
                tmpSendThread.Stop();
            }

            mStopped = true;
            mHandler.Disconnected(that,"creating serve socket failed");
        }else{
            print_debug("Dunno which thread got error: " + error);
        }
    }

    public int GetLocalHostPort() {
        return mHTTPPort;
    }

    private String GetLocalHostAddressAsString() {
        return localHostSocket == null || localHostSocket.getInetAddress() == null ? null : localHostSocket.getInetAddress().toString();
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

        InputStream tmpinStr = mmInStream;
        mmInStream = null;
        if (tmpinStr != null) {
            try {tmpinStr.close();} catch (Exception e) {e.printStackTrace();}
        }

        InputStream tmpinStrLoc = LocalInputStream;
        LocalInputStream = null;
        if (tmpinStrLoc != null) {
            try {tmpinStrLoc.close();} catch (Exception e) {e.printStackTrace();}
        }

        OutputStream tmpoutStrLoc = LocalOutputStream;
        LocalOutputStream = null;
        if (tmpoutStrLoc != null) {
            try {tmpoutStrLoc.close();} catch (Exception e) {e.printStackTrace();}
        }

        OutputStream tmpoutStr = mmOutStream;
        mmOutStream = null;
        if (tmpoutStr != null) {
            try {tmpoutStr.close();} catch (Exception e) {e.printStackTrace();}
        }

        BluetoothSocket tmpbtSoc = mmSocket;
        mmSocket = null;
        if (tmpbtSoc != null) {
            try {tmpbtSoc.close();} catch (Exception e) {e.printStackTrace();}
        }

        Socket tmplhSoc = localHostSocket;
        localHostSocket = null;
        if (tmplhSoc != null) {
            try {tmplhSoc.close();} catch (Exception e) {e.printStackTrace();}
        }
    }

    public void SetIdAddressAndName(String peerId,String peerName,String peerAddress) {
        mPeerId = peerId;
        mPeerName = peerName;
        mPeerAddress = peerAddress;
    }
    public String GetPeerId() {return mPeerId;}
    public String GetPeerName(){
        return mPeerName;
    }
    public String GetPeerAddress(){return mPeerAddress;}

    private void print_debug(String message){
        Log.i("BTConnectedThread", message);
    }



}
