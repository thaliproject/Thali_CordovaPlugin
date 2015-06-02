package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.os.Handler;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Created by juksilve on 15.5.2015.
 */
public class BtConnectedThread extends Thread {

    public static final int MESSAGE_READ         = 0x11;
    public static final int MESSAGE_WRITE        = 0x22;
    public static final int SOCKET_DISCONNEDTED  = 0x33;

    private BluetoothSocket mmSocket;
    private InputStream mmInStream;
    private OutputStream mmOutStream;
    private final Handler mHandler;
    private String mPeerId = "";
    private String mPeerName = "";
    private String mPeerAddress = "";

    final String TAG  = "BTConnectedThread";

    boolean mStopped = false;

    public BtConnectedThread(BluetoothSocket socket, Handler handler,String peerId,String peerName,String peerAddress) {
        Log.d(TAG, "Creating BTConnectedThread");
        mHandler = handler;
        mmSocket = socket;
        mPeerId = peerId;
        mPeerName = peerName;
        mPeerAddress = peerAddress;

        InputStream tmpIn = null;
        OutputStream tmpOut = null;
        // Get the BluetoothSocket input and output streams
        try {
            if(mmSocket != null) {
                tmpIn = mmSocket.getInputStream();
                tmpOut = mmSocket.getOutputStream();
            }
        } catch (IOException e) {
            Log.e(TAG, "Creating temp sockets failed: ", e);
        }
        mmInStream = tmpIn;
        mmOutStream = tmpOut;
    }
    public void run() {
        Log.i(TAG, "BTConnectedThread started");
        byte[] buffer = new byte[1048576];
        int bytes;

        while (true) {
            try {
                if(mmInStream != null) {
                    bytes = mmInStream.read(buffer);
                    //Log.d(TAG, "ConnectedThread read data: " + bytes + " bytes");
                    mHandler.obtainMessage(MESSAGE_READ, bytes, -1, buffer).sendToTarget();
                }
            } catch (IOException e) {
                if(!mStopped) {
                    mStopped = true;
                    Log.e(TAG, "ConnectedThread disconnected: ", e);
                    mHandler.obtainMessage(SOCKET_DISCONNEDTED, -1, -1, e).sendToTarget();
                }
                break;
            }
        }
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

    /**
     * Write to the connected OutStream.
     * @param buffer The bytes to write
     */
    public void write(byte[] buffer) {
        try {
            if(mmOutStream != null) {
                mmOutStream.write(buffer);
                mHandler.obtainMessage(MESSAGE_WRITE, buffer.length, -1, buffer).sendToTarget();
            }
        } catch (IOException e) {
            Log.e(TAG, "ConnectedThread  write failed: ", e);
        }
    }
    public void Stop() {
        mStopped = true;
        if (mmInStream != null) {
            try {mmInStream.close();} catch (Exception e) {}
            mmInStream = null;
        }

        if (mmOutStream != null) {
            try {mmOutStream.close();} catch (Exception e) {}
            mmOutStream = null;
        }

        if (mmSocket != null) {
            try {mmSocket.close();} catch (Exception e) {}
            mmSocket = null;
        }
    }
}
