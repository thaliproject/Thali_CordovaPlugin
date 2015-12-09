package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

/**
 * The base (thread) class for outgoing and incoming socket threads.
 */
abstract class SocketThreadBase extends Thread implements StreamCopyingThread.Listener {
    private static final String SENDING_THREAD_NAME = "Sender";
    private static final String RECEIVING_THREAD_NAME = "Receiver";

    protected static String TAG = SocketThreadBase.class.getName();

    protected final BluetoothSocket mBluetoothSocket;
    protected final ConnectionStatusListener mListener;
    protected final InputStream mBluetoothInputStream;
    protected final OutputStream mBluetoothOutputStream;
    protected Socket mLocalhostSocket = null;
    protected InputStream mLocalInputStream = null;
    protected OutputStream mLocalOutputStream = null;
    protected StreamCopyingThread mSendingThread = null;
    protected StreamCopyingThread mReceivingThread = null;

    private String mPeerId = "";
    private String mPeerName = "";
    private String mPeerAddress = "";

    /**
     * Constructor.
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener The listener.
     * @throws IOException Thrown, if either BluetoothSocket.getInputStream or BluetoothSocket.getOutputStream fails.
     */
    public SocketThreadBase(BluetoothSocket bluetoothSocket, ConnectionStatusListener listener)
            throws IOException {
        mBluetoothSocket = bluetoothSocket;
        mListener = listener;
        mBluetoothInputStream = mBluetoothSocket.getInputStream();
        mBluetoothOutputStream = mBluetoothSocket.getOutputStream();
    }

    public ConnectionStatusListener getListener() {
        return mListener;
    }

    public String getPeerId() {
        return mPeerId;
    }

    public String getPeerName() {
        return mPeerName;
    }

    public String getPeerAddress() {
        return mPeerAddress;
    }

    public void setPeerProperties(String peerId, String peerName, String peerAddress) {
        mPeerId = peerId;
        mPeerName = peerName;
        mPeerAddress = peerAddress;
    }

    /**
     * Resolves the address of the local host.
     * @return The local host address as a string or null in case of a failure.
     */
    public String getLocalHostAddressAsString() {
        return mLocalhostSocket == null
                || mLocalhostSocket.getInetAddress() == null
                    ? null : mLocalhostSocket.getInetAddress().toString();
    }

    /**
     * Closes all sub threads, sockets and streams.
     */
    public synchronized void close() {
        if (mReceivingThread != null) {
            Log.i(TAG, "close: Stopping receiving thread...");
            mReceivingThread.doStop();
            mReceivingThread = null;
        }

        if (mSendingThread != null) {
            Log.i(TAG, "close: Stopping sending thread...");
            mSendingThread.doStop();
            mSendingThread = null;
        }

        closeLocalSocketAndStreams();
        closeBluetoothSocketAndStreams();
    }

    /**
     * Logs the error and notifies the listener that we got disconnected.
     * @param who The thread, which failed.
     * @param errorMessage The error message.
     */
    @Override
    public void onStreamCopyError(StreamCopyingThread who, String errorMessage) {
        if (who == mReceivingThread) {
            // The receiving thread is the one having the Bluetooth input stream. Thus, if it fails,
            // we know that connection was disconnected from the other end.
            Log.e(TAG, "The receiving thread failed with error \"" + errorMessage
                    + "\", this is likely due to peer having disconnected");
        } else if (who == mSendingThread) {
            // The sending thread has the local input stream. Thus, if it fails, we are getting a
            // local disconnect.
            Log.e(TAG, "The sending thread failed with error: " + errorMessage);
        } else {
            Log.e(TAG, "Unidentified stream copying thread failed with error: " + errorMessage);
        }

        mListener.onDisconnected(this, errorMessage);
    }

    /**
     * Logs the event.
     * @param who The thread, which succeeded in reading and writing.
     * @param numberOfBytes The number of bytes read and written.
     */
    @Override
    public void onStreamCopySucceeded(StreamCopyingThread who, int numberOfBytes) {
        if (who == mReceivingThread) {
            Log.i(TAG, "The receiving thread succeeded to read/write " + numberOfBytes + " bytes");
        } else if (who == mSendingThread) {
            Log.i(TAG, "The sending thread succeeded to read/write " + numberOfBytes + " bytes");
        } else {
            Log.w(TAG, "An unidentified stream copying thread succeeded to read/write " + numberOfBytes + " bytes");
        }
    }

    /**
     * Creates the stream copying threads (one for sending and one for receiving) and starts them.
     */
    protected synchronized void startStreamCopyingThreads() {
        if (mBluetoothInputStream == null
                || mLocalInputStream == null
                || mBluetoothOutputStream == null
                || mLocalOutputStream == null
                || mLocalhostSocket == null) {
            Log.e(TAG, "startStreamCopyingThreads: Cannot start since at least one of the streams is null");
            mListener.onDisconnected(this, "Cannot start stream copying threads since at least one of the streams is null");
        } else {
            mSendingThread = new StreamCopyingThread(this, mLocalInputStream, mBluetoothOutputStream, SENDING_THREAD_NAME);
            mSendingThread.setDefaultUncaughtExceptionHandler(this.getUncaughtExceptionHandler());
            mSendingThread.setBufferSize(1024 * 8);
            mSendingThread.start();

            mReceivingThread = new StreamCopyingThread(this, mBluetoothInputStream, mLocalOutputStream, RECEIVING_THREAD_NAME);
            mReceivingThread.setDefaultUncaughtExceptionHandler(this.getUncaughtExceptionHandler());
            mReceivingThread.setBufferSize(1024 * 8);
            mReceivingThread.start();

            Log.i(TAG, "startStreamCopyingThreads: OK");
        }
    }

    /**
     * Closes the local socket and streams.
     */
    protected synchronized void closeLocalSocketAndStreams() {
        if (mLocalhostSocket == null && mLocalInputStream == null && mLocalOutputStream == null) {
            Log.i(TAG, "closeLocalSocketAndStreams: Nothing to close");
        } else {
            Log.i(TAG, "closeLocalSocketAndStreams: Closing...");
        }

        if (mLocalInputStream != null) {
            try {
                Log.i(TAG, "closeLocalSocketAndStreams: Closing the local input stream...");
                mLocalInputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "closeLocalSocketAndStreams: Failed to close the local input stream: " + e.getMessage(), e);
            }
        }

        if (mLocalOutputStream != null) {
            try {
                Log.i(TAG, "closeLocalSocketAndStreams: Closing the local output stream...");
                mLocalOutputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "closeLocalSocketAndStreams: Failed to close the local output stream: " + e.getMessage(), e);
            }
        }

        if (mLocalhostSocket != null) {
            try {
                Log.i(TAG, "closeLocalSocketAndStreams: Closing the localhost socket...");
                mLocalhostSocket.close();
            } catch (IOException e) {
                Log.e(TAG, "closeLocalSocketAndStreams: Failed to close the localhost socket: " + e.getMessage(), e);
            }
        }
    }

    /**
     * Closes the Bluetooth socket and streams.
     */
    protected synchronized void closeBluetoothSocketAndStreams() {
        Log.i(TAG, "closeBluetoothSocketAndStreams");

        if (mBluetoothInputStream != null) {
            try {
                mBluetoothInputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "closeBluetoothSocketAndStreams: Failed to close the input stream: " + e.getMessage(), e);
            }
        }

        if (mBluetoothOutputStream != null) {
            try {
                mBluetoothOutputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "closeBluetoothSocketAndStreams: Failed to close the output stream: " + e.getMessage(), e);
            }
        }

        if (mBluetoothSocket != null) {
            try {
                mBluetoothSocket.close();
            } catch (IOException e) {
                Log.e(TAG, "closeBluetoothSocketAndStreams: Failed to close the Bluetooth socket: " + e.getMessage(), e);
            }
        }
    }
}
