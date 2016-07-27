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

        /**
         * Called when either the sending or the receiving thread is done.
         *
         * @param who The associated SocketThreadBase instance (this).
         * @param threadDoneWasSending If true, the sending thread is done. If false, the receiving thread is done.
         */
        void onDone(SocketThreadBase who, boolean threadDoneWasSending);

        void onDisconnected(SocketThreadBase who, String errorMessage);
    }

    private static final String SENDING_THREAD_NAME = "Sender";
    private static final String RECEIVING_THREAD_NAME = "Receiver";
    private static final int STREAM_COPYING_THREAD_BUFFER_SIZE = 1024 * 4;

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

        if (mReceivingThread != null) {
            Log.v(mTag, "close: Stopping receiving thread...");
            mReceivingThread.close();
            mReceivingThread = null;
        }

        if (mSendingThread != null) {
            Log.v(mTag, "close: Stopping sending thread...");
            mSendingThread.close();
            mSendingThread = null;
        }

        if (mBluetoothSocket != null) {
            try {
                Log.v(mTag, "close: Closing the Bluetooth socket...");
                mBluetoothSocket.close();
            } catch (IOException e) {
                Log.e(mTag, "close: Failed to close the Bluetooth socket: " + e.getMessage(), e);
            }
        }

        if (mLocalhostSocket != null) {
            try {
                Log.v(mTag, "close: Closing the localhost socket...");
                mLocalhostSocket.close();
            } catch (IOException e) {
                Log.e(mTag, "close: Failed to close the localhost socket: " + e.getMessage(), e);
            }

            mLocalhostSocket = null;
        }

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
     *
     * @param who The StreamCopyingThread that is done.
     */
    @Override
    public void onStreamCopyingThreadDone(final StreamCopyingThread who) {
        if (who == mReceivingThread) {
            Log.i(mTag, "The receiving thread is done");
        } else if (who == mSendingThread) {
            Log.i(mTag, "The sending thread is done");
        } else {
            Log.i(mTag, "Unidentified stream copying thread done");
        }

        final SocketThreadBase socketThreadBase = this;

        /*jxcore.coreThread.handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                mListener.onDone(socketThreadBase, (who == mSendingThread));
            }
        }, 1000);*/

        if (mReceivingThread.getIsDone() && mSendingThread.getIsDone()) {
            Log.i(mTag, "Both threads are done, notifying the listener...");
            mListener.onDone(socketThreadBase, (who == mSendingThread));
        }
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
            String[] temp = mTag.split("\\.");
            String shortName;

            if (temp.length > 0) {
                shortName = temp[temp.length - 1];
            } else {
                shortName = mTag;
            }

            mSendingThread = new StreamCopyingThread(this, mLocalInputStream, mBluetoothOutputStream, shortName + "/" + SENDING_THREAD_NAME);
            mSendingThread.setUncaughtExceptionHandler(this.getUncaughtExceptionHandler());
            mSendingThread.setBufferSize(STREAM_COPYING_THREAD_BUFFER_SIZE);
            mSendingThread.setNotifyStreamCopyingProgress(true);
            mSendingThread.start();

            mReceivingThread = new StreamCopyingThread(this, mBluetoothInputStream, mLocalOutputStream, shortName + "/" + RECEIVING_THREAD_NAME);
            mReceivingThread.setUncaughtExceptionHandler(this.getUncaughtExceptionHandler());
            mReceivingThread.setBufferSize(STREAM_COPYING_THREAD_BUFFER_SIZE);
            mReceivingThread.setNotifyStreamCopyingProgress(true);
            mReceivingThread.start();

            Log.i(mTag, "startStreamCopyingThreads: OK (thread ID: " + getId() + ")");
        }
    }
}
