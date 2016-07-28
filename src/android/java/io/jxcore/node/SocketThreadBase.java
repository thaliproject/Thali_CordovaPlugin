/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

/**
 * The base (thread) class for outgoing and incoming socket threads.
 */
abstract class SocketThreadBase extends Thread implements StreamCopyingThread.Listener {
    public interface Listener {
        void onListeningForIncomingConnections(int portNumber);

        void onDataTransferred(int numberOfBytes);

        void onDisconnected(SocketThreadBase who, String errorMessage);
    }

    private static final String SENDING_THREAD_NAME = "Sender";
    private static final String RECEIVING_THREAD_NAME = "Receiver";

    protected final BluetoothSocket mBluetoothSocket;
    protected final Listener mListener;
    protected final InputStream mBluetoothInputStream;
    protected final OutputStream mBluetoothOutputStream;
    protected String mTag = SocketThreadBase.class.getName();
    protected Socket mLocalhostSocket = null;
    protected InputStream mLocalInputStream = null;
    protected OutputStream mLocalOutputStream = null;
    protected StreamCopyingThread mSendingThread = null;
    protected StreamCopyingThread mReceivingThread = null;
    protected PeerProperties mPeerProperties = null;
    protected boolean mIsClosing = false;

    /**
     * Constructor.
     *
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener        The listener.
     * @throws IOException Thrown, if either BluetoothSocket.getInputStream or BluetoothSocket.getOutputStream fails.
     */
    public SocketThreadBase(BluetoothSocket bluetoothSocket, Listener listener)
            throws IOException {
        this(bluetoothSocket, listener, bluetoothSocket.getInputStream(),
                bluetoothSocket.getOutputStream());
    }

    /**
     * Constructor for test purposes.
     *
     * @param bluetoothSocket The Bluetooth socket.
     * @param listener        The listener.
     * @param inputStream     The InputStream.
     * @param outputStream    The OutputStream.
     */
    public SocketThreadBase(BluetoothSocket bluetoothSocket, Listener listener,
                            InputStream inputStream, OutputStream outputStream) {
        mBluetoothInputStream = inputStream;
        mBluetoothOutputStream = outputStream;
        mListener = listener;
        mBluetoothSocket = bluetoothSocket;
    }

    public Listener getListener() {
        return mListener;
    }

    public PeerProperties getPeerProperties() {
        return mPeerProperties;
    }

    public void setPeerProperties(PeerProperties peerProperties) {
        mPeerProperties = peerProperties;
    }

    /**
     * Resolves the address of the local host.
     *
     * @return The local host address as a string or null in case of a failure.
     */
    public String getLocalHostAddressAsString() {
        Socket localCopyOfmLocalHostSocket = mLocalhostSocket;
        return localCopyOfmLocalHostSocket == null
                || localCopyOfmLocalHostSocket.getInetAddress() == null
                ? null : localCopyOfmLocalHostSocket.getInetAddress().toString();
    }

    /**
     * Closes all sub threads, sockets and streams.
     */
    public synchronized void close() {
        mIsClosing = true;
        closeBluetoothSocketAndStreams();

        if (mReceivingThread != null) {
            Log.d(mTag, "close: Stopping receiving thread...");
            mReceivingThread.doStop();
            mReceivingThread = null;
        }

        if (mSendingThread != null) {
            Log.d(mTag, "close: Stopping sending thread...");
            mSendingThread.doStop();
            mSendingThread = null;
        }

        closeLocalSocketAndStreams();
        Log.i(mTag, "close: Complete (thread ID: " + getId() + ")");
    }

    /**
     * Compares this SocketThreadBase instead to the given one. Two SocketThreadBase instances are
     * considered equal when the peers associated with them share the same ID
     * i.e. PeerProperties.equals returns true.
     *
     * @param other The other SocketThreadBase to compare this to.
     * @return True, if the instances match. False otherwise.
     */
    @Override
    public boolean equals(Object other) {
        if (other instanceof SocketThreadBase) {
            SocketThreadBase otherSocketThreadBase = (SocketThreadBase) other;

            return (otherSocketThreadBase.getPeerProperties() != null
                    && mPeerProperties != null
                    && otherSocketThreadBase.getPeerProperties().equals(mPeerProperties));
        }

        return false;
    }

    /**
     * Logs the error and notifies the listener that we got disconnected.
     *
     * @param who          The thread, which failed.
     * @param errorMessage The error message.
     */
    @Override
    public void onStreamCopyError(StreamCopyingThread who, String errorMessage) {
        if (!mIsClosing) {
            if (who == mReceivingThread) {
                // The receiving thread is the one having the Bluetooth input stream. Thus, if it fails,
                // we know that connection was disconnected from the other end.
                Log.e(mTag, "The receiving thread failed with error \"" + errorMessage
                        + "\", this is likely due to peer having disconnected");
            } else if (who == mSendingThread) {
                // The sending thread has the local input stream. Thus, if it fails, we are getting a
                // local disconnect.
                Log.e(mTag, "The sending thread failed with error: " + errorMessage);
            } else {
                Log.e(mTag, "Unidentified stream copying thread failed with error: " + errorMessage);
            }

            mListener.onDisconnected(this, errorMessage);
        }
    }

    /**
     * Logs the event and notifies the listener.
     *
     * @param who           The thread, which succeeded in reading and writing.
     * @param numberOfBytes The number of bytes read and written.
     */
    @Override
    public void onStreamCopySucceeded(StreamCopyingThread who, int numberOfBytes) {
        // Uncomment the following to debug chunks of data transferred
        /*if (who == mReceivingThread) {
            Log.d(mTag, "The receiving thread succeeded to read/write " + numberOfBytes + " bytes");
        } else if (who == mSendingThread) {
            Log.d(mTag, "The sending thread succeeded to read/write " + numberOfBytes + " bytes");
        } else {
            Log.w(mTag, "An unidentified stream copying thread succeeded to read/write " + numberOfBytes + " bytes");
        }*/

        mListener.onDataTransferred(numberOfBytes);
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
            Log.e(mTag, "startStreamCopyingThreads: Cannot start since at least one of the streams is null");
            mListener.onDisconnected(this, "Cannot start stream copying threads since at least one of the streams is null");
        } else {
            mSendingThread = new StreamCopyingThread(this, mLocalInputStream, mBluetoothOutputStream, SENDING_THREAD_NAME);
            mSendingThread.setUncaughtExceptionHandler(this.getUncaughtExceptionHandler());
            mSendingThread.setBufferSize(1024 * 8);
            mSendingThread.setNotifyStreamCopyingProgress(true);
            mSendingThread.start();

            mReceivingThread = new StreamCopyingThread(this, mBluetoothInputStream, mLocalOutputStream, RECEIVING_THREAD_NAME);
            mReceivingThread.setUncaughtExceptionHandler(this.getUncaughtExceptionHandler());
            mReceivingThread.setBufferSize(1024 * 8);
            mReceivingThread.setNotifyStreamCopyingProgress(true);
            mReceivingThread.start();

            Log.i(mTag, "startStreamCopyingThreads: OK (thread ID: " + getId() + ")");
        }
    }

    /**
     * Closes the local socket and streams.
     */
    protected synchronized void closeLocalSocketAndStreams() {
        if (mLocalhostSocket == null && mLocalInputStream == null && mLocalOutputStream == null) {
            Log.d(mTag, "closeLocalSocketAndStreams: Nothing to close (thread ID: " + getId() + ")");
        } else {
            Log.d(mTag, "closeLocalSocketAndStreams: Closing... (thread ID: " + getId() + ")");
        }

        if (mLocalInputStream != null) {
            try {
                //Log.v(mTag, "closeLocalSocketAndStreams: Closing the local input stream...");
                mLocalInputStream.close();
            } catch (IOException e) {
                Log.e(mTag, "closeLocalSocketAndStreams: Failed to close the local input stream: " + e.getMessage(), e);
            }

            mLocalInputStream = null;
        }

        if (mLocalOutputStream != null) {
            try {
                //Log.v(mTag, "closeLocalSocketAndStreams: Closing the local output stream...");
                mLocalOutputStream.close();
            } catch (IOException e) {
                Log.e(mTag, "closeLocalSocketAndStreams: Failed to close the local output stream: " + e.getMessage(), e);
            }

            mLocalOutputStream = null;
        }

        if (mLocalhostSocket != null) {
            try {
                //Log.v(mTag, "closeLocalSocketAndStreams: Closing the localhost socket...");
                mLocalhostSocket.close();
            } catch (IOException e) {
                Log.e(mTag, "closeLocalSocketAndStreams: Failed to close the localhost socket: " + e.getMessage(), e);
            }

            mLocalhostSocket = null;
        }
    }

    /**
     * Closes the Bluetooth socket and streams.
     */
    protected synchronized void closeBluetoothSocketAndStreams() {
        Log.d(mTag, "closeBluetoothSocketAndStreams: Closing... (thread ID: " + getId() + ")");

        if (mBluetoothInputStream != null) {
            try {
                mBluetoothInputStream.close();
            } catch (IOException e) {
                Log.e(mTag, "closeBluetoothSocketAndStreams: Failed to close the input stream: " + e.getMessage(), e);
            }
        }

        if (mBluetoothOutputStream != null) {
            try {
                mBluetoothOutputStream.close();
            } catch (IOException e) {
                Log.e(mTag, "closeBluetoothSocketAndStreams: Failed to close the output stream: " + e.getMessage(), e);
            }
        }

        if (mBluetoothSocket != null) {
            try {
                mBluetoothSocket.close();
                Log.d(mTag, "closeBluetoothSocketAndStreams: Bluetooth socket closed");
            } catch (IOException e) {
                Log.e(mTag, "closeBluetoothSocketAndStreams: Failed to close the Bluetooth socket: " + e.getMessage(), e);
            }
        }
    }
}
