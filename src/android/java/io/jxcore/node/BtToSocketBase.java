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

    final BtToSocketBase that = this;
    protected final BtSocketDisconnectedCallBack mHandler;

    protected final BluetoothSocket mmSocket;
    protected Socket localHostSocket = null;

    protected final InputStream mmInStream;
    protected final OutputStream mmOutStream;
    protected InputStream LocalInputStream = null;
    protected OutputStream LocalOutputStream = null;

    private String mPeerId = "";
    private String mPeerName = "";
    private String mPeerAddress = "";

    protected StreamCopyingThread SendingThread = null;
    protected StreamCopyingThread ReceivingThread = null;

    public BtToSocketBase(BluetoothSocket socket, BtSocketDisconnectedCallBack handler) throws IOException {
        Log.i("BtToSocketBase","BtToSocketBase BtConnectedRequestSocket");
        mHandler = handler;
        mmSocket = socket;
        mmInStream = mmSocket.getInputStream();
        mmOutStream = mmSocket.getOutputStream();
    }

    protected void StartStreamCopyThreads() {
        if (mmInStream == null || LocalInputStream == null || mmOutStream == null || LocalOutputStream == null || localHostSocket == null) {
            Log.i("BtToRequestSocket", "at least one stream is null");
            mHandler.Disconnected(that, "at least one stream is null");
            return;
        }

        SendingThread = new StreamCopyingThread(this, LocalInputStream, mmOutStream);
        // as we have set DefaultUncaughtExceptionHandler for the main thread, we can forward any exceptions from copy thread as well
        SendingThread.setDefaultUncaughtExceptionHandler(that.getUncaughtExceptionHandler());
        SendingThread.start();

        ReceivingThread = new StreamCopyingThread(this, mmInStream, LocalOutputStream);
        // as we have set DefaultUncaughtExceptionHandler for the main thread, we can forward any exceptions from copy thread as well
        ReceivingThread.setDefaultUncaughtExceptionHandler(that.getUncaughtExceptionHandler());
        ReceivingThread.start();
    }
    @Override
    public void StreamCopyError(StreamCopyingThread who, String error) {

        if(who == ReceivingThread){
            // Receiving Thread is the one that is having Bluetooth input stream,
            // thus if it gives error, we know that connection has been disconnected from other end.
            Log.i("BtToSocketBase","ReceivingThread thread got error: " + error);
        }else if(who == SendingThread){
            //Sending socket has local input stream,
            // thus if it is giving error we are getting local disconnection
            Log.i("BtToSocketBase","SendingThread thread got error: " + error);
        }else{
            Log.i("BtToSocketBase","Dunno which thread got error: " + error);
        }
        mHandler.Disconnected(that,error);
    }

    public String GetLocalHostAddressAsString() {
        return localHostSocket == null || localHostSocket.getInetAddress() == null ? null : localHostSocket.getInetAddress().toString();
    }

    public void Stop() {

        StreamCopyingThread tmpSCTrec = ReceivingThread;
        ReceivingThread = null;
        if(tmpSCTrec != null){
            Log.i("BtToSocketBase","Stop ReceivingThread");
            tmpSCTrec.Stop();
        }

        StreamCopyingThread tmpSCTsend = SendingThread;
        SendingThread = null;
        if(tmpSCTsend != null){
            Log.i("BtToSocketBase","Stop SendingThread");
            tmpSCTsend.Stop();
        }

        CloseSocketAndStreams();

        if (mmInStream != null) {
            try {Log.i("BtToSocketBase","Close bt in");
                mmInStream.close();} catch (IOException e) {Log.i("BtToSocketBase","Close error : " + e.toString());}
        }

        if (mmOutStream != null) {
            try {Log.i("BtToSocketBase","Close bt out");
                mmOutStream.close();} catch (IOException e) {Log.i("BtToSocketBase","Close error : " + e.toString());}
        }

        if (mmSocket != null) {
            try {Log.i("BtToSocketBase","Close bt socket");
                mmSocket.close();} catch (IOException e) {Log.i("BtToSocketBase","Close error : " + e.toString());}
        }
    }

    protected  void CloseSocketAndStreams() {

        InputStream tmpLocStrIn = LocalInputStream;
        LocalInputStream = null;
        if (tmpLocStrIn != null) {
            try {Log.i("BtToSocketBase","Close local in");
                tmpLocStrIn.close();} catch (IOException e) {
                Log.i("BtToSocketBase","Close error : " + e.toString());
            }
        }

        OutputStream tmpLocStrOut = LocalOutputStream;
        LocalOutputStream = null;
        if (tmpLocStrOut != null) {
            try {Log.i("BtToSocketBase","Close LocalOutputStream");
                tmpLocStrOut.close();} catch (IOException e) {
                Log.i("BtToSocketBase","Close error : " + e.toString());
            }
        }

        Socket tmpLHSoc = localHostSocket;
        localHostSocket = null;
        if (tmpLHSoc != null) {
            try {Log.i("BtToSocketBase","Close localHostSocket");
                tmpLHSoc.close();} catch (IOException e) {
                Log.i("BtToSocketBase","Close error : " + e.toString());
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
}
