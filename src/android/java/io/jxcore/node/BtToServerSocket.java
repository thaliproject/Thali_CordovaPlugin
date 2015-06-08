package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.os.Handler;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketAddress;

/**
 * Created by juksilve on 15.5.2015.
 */
public class BtToServerSocket extends Thread implements StreamCopyingThread.CopyThreadCallback {

    public static final int MESSAGE_READ         = 0x11;
    public static final int MESSAGE_WRITE        = 0x22;
    public static final int SOCKET_DISCONNEDTED  = 0x33;

    private BluetoothSocket mmSocket = null;;
    private Socket localHostSocket = null;

    private InputStream mmInStream = null;
    private OutputStream mmOutStream = null;
    private InputStream LocalInputStream = null;
    private OutputStream LocalOutputStream = null;
    private Handler mHandler;
    private String mPeerId = "";
    private String mPeerName = "";
    private String mPeerAddress = "";

    private StreamCopyingThread SendingThread = null;
    private StreamCopyingThread ReceivingThread = null;
    private Inet4Address mLocalHostAddress = null;

    final String TAG  = "BTConnectedThread";

    private int mHTTPPort = 6654; //todo fix me later

    boolean mStopped = false;

    public BtToServerSocket(BluetoothSocket socket, Handler handler) {
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
            mLocalHostAddress = (Inet4Address) Inet4Address.getByName("localhost");
            localHostSocket = new Socket(mLocalHostAddress, mHTTPPort);

            if(localHostSocket != null){
                mHTTPPort = localHostSocket.getPort();
            }
            print_debug("LocalHost addr: " + GetLocalHostAddress() + ", port: " + GetLocalHostPort());

            print_debug("Get local streams");
            tmpInputStream = localHostSocket.getInputStream();
            tmpOutputStream = localHostSocket.getOutputStream();

        } catch (Exception e) {
            print_debug("Creating temp sockets failed: " + e.toString());
        }
        LocalInputStream = tmpInputStream;
        LocalOutputStream = tmpOutputStream;

        if (mmInStream != null && LocalInputStream != null
         && mmOutStream != null && LocalOutputStream != null
         && localHostSocket != null) {

            SendingThread = new StreamCopyingThread(this,LocalInputStream, mmOutStream);
            SendingThread.setDebugTag("--Sending");
            SendingThread.start();

            ReceivingThread = new StreamCopyingThread(this,mmInStream, LocalOutputStream);
            ReceivingThread.setDebugTag("--Receiving");
            ReceivingThread.start();

            print_debug("Stream Threads are running");
        }else{
            mStopped = true;
            print_debug("at least one stream is null");
            mHandler.obtainMessage(SOCKET_DISCONNEDTED, -1, -1, "at least one stream is null").sendToTarget();
        }
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

        if (mmInStream != null) {
            try {mmInStream.close();} catch (Exception e) {}
            mmInStream = null;
        }

        if (LocalInputStream != null) {
            try {LocalInputStream.close();} catch (Exception e) {}
            LocalInputStream = null;
        }

        if (LocalOutputStream != null) {
            try {LocalOutputStream.close();} catch (Exception e) {}
            LocalOutputStream = null;
        }

        if (mmOutStream != null) {
            try {mmOutStream.close();} catch (Exception e) {}
            mmOutStream = null;
        }

        if (mmSocket != null) {
            try {mmSocket.close();} catch (Exception e) {}
            mmSocket = null;
        }
        if (localHostSocket != null) {
            try {localHostSocket.close();} catch (Exception e) {}
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
