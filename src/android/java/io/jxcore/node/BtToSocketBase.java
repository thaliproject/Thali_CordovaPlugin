package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

/**
 * Created by juksilve on 25.8.2015.
 */
public class BtToSocketBase extends Thread implements StreamCopyingThread.CopyThreadCallback  {

    BtToSocketBase that = this;
    protected final BtSocketDisconnectedCallBack mHandler;

    protected BluetoothSocket mmSocket = null;
    protected Socket localHostSocket = null;

    protected InputStream mmInStream = null;
    protected OutputStream mmOutStream = null;
    protected InputStream LocalInputStream = null;
    protected OutputStream LocalOutputStream = null;

    private String mPeerId = "";
    private String mPeerName = "";
    private String mPeerAddress = "";

    protected StreamCopyingThread SendingThread = null;
    protected StreamCopyingThread ReceivingThread = null;

    protected volatile boolean mStopped = false;

    public BtToSocketBase(BluetoothSocket socket, BtSocketDisconnectedCallBack handler) throws IOException {
        print_debug("BtToSocketBase","BtToSocketBase BtConnectedRequestSocket");
        mHandler = handler;
        mmSocket = socket;
        mmInStream = mmSocket.getInputStream();
        mmOutStream = mmSocket.getOutputStream();
    }

    @Override
    public void StreamCopyError(StreamCopyingThread who, String error) {
        // Receiving Thread is the one that is having Bluetooth input stream,
        // thus if it gives error, we know that connection has been disconnected from other end.
        if(who == ReceivingThread){
            print_debug("BtToSocketBase","ReceivingThread thread got error: " + error);
            mStopped = true;
            mHandler.Disconnected(that,"creating serve socket failed");
        }else if(who == SendingThread){
            //Sending socket has local input stream, thus if it is giving error we are getting local disconnection
            // thus we should do round to get new local connection
            print_debug("BtToSocketBase","SendingThread thread got error: " + error);
            mStopped = true;
            // with this app we want to disconnect the Bluetooth once we lose local sockets
            mHandler.Disconnected(that,error);
        }else{
            print_debug("BtToSocketBase","Dunno which thread got error: " + error);
            mHandler.Disconnected(that,error);
        }
    }

    public String GetLocalHostAddressAsString() {
        return localHostSocket == null || localHostSocket.getInetAddress() == null ? null : localHostSocket.getInetAddress().toString();
    }

    public void Stop() {
        mStopped = true;

        StreamCopyingThread tmpSCTrec = ReceivingThread;
        ReceivingThread = null;
        if(tmpSCTrec != null){
            print_debug("BtToSocketBase","Stop ReceivingThread");
            tmpSCTrec.Stop();
        }

        StreamCopyingThread tmpSCTsend = SendingThread;
        SendingThread = null;
        if(tmpSCTsend != null){
            print_debug("BtToSocketBase","Stop SendingThread");
            tmpSCTsend.Stop();
        }

        CloseSocketAndStreams();

        InputStream tmpInStr = mmInStream;
        mmInStream = null;
        if (tmpInStr != null) {
            try {print_debug("BtToSocketBase","Close bt in");
                tmpInStr.close();} catch (Exception e) {print_debug("BtToSocketBase","Close error : " + e.toString());}
        }

        OutputStream tmpOutStr = mmOutStream;
        mmOutStream = null;
        if (tmpOutStr != null) {
            try {print_debug("BtToSocketBase","Close bt out");
                tmpOutStr.close();} catch (Exception e) {print_debug("BtToSocketBase","Close error : " + e.toString());}
        }

        BluetoothSocket tmpSoc = mmSocket;
        mmSocket = null;
        if (tmpSoc != null) {
            try {print_debug("BtToSocketBase","Close bt socket");
                tmpSoc.close();} catch (Exception e) {print_debug("BtToSocketBase","Close error : " + e.toString());}
        }
    }

    protected  void CloseSocketAndStreams() {

        InputStream tmpLocStrIn = LocalInputStream;
        LocalInputStream = null;
        if (tmpLocStrIn != null) {
            try {print_debug("BtToSocketBase","Close local in");
                tmpLocStrIn.close();} catch (Exception e) {
                print_debug("BtToSocketBase","Close error : " + e.toString());
            }
        }

        OutputStream tmpLocStrOut = LocalOutputStream;
        LocalOutputStream = null;
        if (tmpLocStrOut != null) {
            try {print_debug("BtToSocketBase","Close LocalOutputStream");
                tmpLocStrOut.close();} catch (Exception e) {
                print_debug("BtToSocketBase","Close error : " + e.toString());
            }
        }

        Socket tmpLHSoc = localHostSocket;
        localHostSocket = null;
        if (tmpLHSoc != null) {
            try {print_debug("BtToSocketBase","Close localHostSocket");
                tmpLHSoc.close();} catch (Exception e) {
                print_debug("BtToSocketBase","Close error : " + e.toString());
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
    public String GetPeerName(){return mPeerName;}
    public String GetPeerAddress(){return mPeerAddress;}

    protected  void print_debug(String who,String message){
        Log.i(who, message);
    }
}
