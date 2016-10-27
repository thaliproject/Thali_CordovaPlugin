/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.os.CountDownTimer;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Copies content from the input stream to the output stream.
 */
class StreamCopyingThread extends Thread {

    interface Listener {
        /**
         * Called when the end of the stream has been reached (InputStream.read returns -1).
         *
         * @param who The StreamCopyingThread that is done.
         */
        void onStreamCopyingThreadDone(StreamCopyingThread who);

        /**
         * Called when copying the content fails. If this error occurs, the thread is exited.
         *
         * @param who          The thread, which failed.
         * @param errorMessage The error message.
         */
        void onStreamCopyError(StreamCopyingThread who, String errorMessage);

        /**
         * Called when a block of numberOfBytes bytes is read and written successfully.
         * Call setNotifyStreamCopyingProgress(true) to enable. By default, this callback is not
         * called.
         *
         * @param who           The thread, which succeeded in reading and writing.
         * @param numberOfBytes The number of bytes read and written.
         */
        void onStreamCopySucceeded(StreamCopyingThread who, int numberOfBytes);
    }

    private static final String TAG = StreamCopyingThread.class.getName();
    private static final int MAXIMUM_BUFFER_SIZE_IN_BYTES = 1024 * 8;
    private static final int DEFAULT_BUFFER_SIZE = 1024 * 4;
    private final Listener mListener;
    private final InputStream mInputStream;
    private final OutputStream mOutputStream;
    private final String mThreadName;
    private int mBufferSize = DEFAULT_BUFFER_SIZE;
    private boolean mNotifyStreamCopyingProgress = false;
    private boolean mIsInputStreamDone = false;
    private boolean mDoStop = false;
    private boolean mIsClosed = false;
    private boolean fromBluetoothToTCP = false;

    private ConnectionData connectionData;

    /**
     * Constructor. Note that the responsibility to close the given streams is that of the caller
     * i.e. this class will not take ownership.
     *
     * @param listener     The listener.
     * @param inputStream  The input stream.
     * @param outputStream The output stream.
     * @param threadName   The name for the thread so it can be easily identified from the logs.
     */
    public StreamCopyingThread(
        Listener listener,
        InputStream inputStream, OutputStream outputStream,
        String threadName,
        ConnectionData connectionData,
        boolean fromBluetoothToTCP) {
        mListener = listener;
        mInputStream = inputStream;
        mOutputStream = outputStream;
        mThreadName = threadName;
        this.connectionData = connectionData;
        this.fromBluetoothToTCP = fromBluetoothToTCP;
    }

    public void setBufferSize(final int bufferSizeInBytes) {
        if (bufferSizeInBytes > 0 && bufferSizeInBytes <= MAXIMUM_BUFFER_SIZE_IN_BYTES) {
            Log.i(TAG, "setBufferSize: Setting buffer size to " + bufferSizeInBytes + " bytes");
            mBufferSize = bufferSizeInBytes;
        } else {
            throw new IllegalArgumentException("bufferSizeInBytes must be > 0 and less than " +
                MAXIMUM_BUFFER_SIZE_IN_BYTES);
        }
    }

    /**
     * Enables/disables stream copying progress notifications (listener callbacks).
     * The notifications may affect the stream copying performance, is not recommended and are
     * disabled by default.
     *
     * @param notify If true, will enable notifications. If false, will disable them.
     */
    public void setNotifyStreamCopyingProgress(boolean notify) {
        mNotifyStreamCopyingProgress = notify;
    }

    /**
     * @return True, if the input stream is done (the end of the stream was reached).
     */
    public boolean getIsDone() {
        return mIsInputStreamDone;
    }

    /**
     * From Thread.
     * <p>
     * Keeps on copying the content of the input stream to the output stream.
     */
    @Override
    public void run() {
        Log.d(TAG, "Entering thread (ID: " + getId() + ", name: " + mThreadName + "). Connection data: " + connectionData.toString());
        byte[] buffer = new byte[mBufferSize];
        int numberOfBytesRead = 0;

        // Byte counters for debugging
        long totalNumberOfBytesRead = 0;
        long totalNumberOfBytesWritten = 0;

        boolean isFlushing = false;
        boolean isRead = false;

        try {
            while (!mDoStop && (numberOfBytesRead = mInputStream.read(buffer)) != -1) {
                // Uncomment the logging, if you need to debug the stream copying process.
                // However, note that Log calls are quite heavy and should be used here only, if
                // necessary.

                totalNumberOfBytesRead += numberOfBytesRead;
                isRead = true;
                mOutputStream.write(buffer, 0, numberOfBytesRead); // Can throw IOException

                isFlushing = true;
                mOutputStream.flush(); // Can throw IOException
                isFlushing = false;

                totalNumberOfBytesWritten += numberOfBytesRead;

                if (mNotifyStreamCopyingProgress) {
                    Log.v(TAG, mThreadName+ " " + "recieved " + numberOfBytesRead + " bytes from " +
                            (fromBluetoothToTCP?" Bluetooth and send it to TCP":" TCP and send it to Bluetooth")
                            + connectionData.toString());
                    mListener.onStreamCopySucceeded(this, numberOfBytesRead);
                }
                numberOfBytesRead = 0;
                isRead = false;
            }
        } catch (IOException e) {
            if (!mDoStop) {
                String errorMessage;
                if (isRead) {
                    if (isFlushing) {
                        errorMessage = "Failed to flush the output stream";
                    } else {
                        errorMessage = "Failed to write to the output stream";
                    }
                } else {
                    errorMessage = "Failed to read from input stream, got IO, not -1. Number of bytes read " + numberOfBytesRead;
                }

                Log.e(TAG, errorMessage + " (thread ID: " + getId() + ", thread name: " + mThreadName + "): " + e.getMessage());
                errorMessage += ": " + e.getMessage();
                final String msg = errorMessage;
                Log.d(TAG, "onStreamCopyError (ID: " + getId() + ", name: " + mThreadName
                    + "). Connection data: " + connectionData.toString() +
                    " .During the lifetime of the thread the total number of bytes read was "
                    + totalNumberOfBytesRead + " and the total number of bytes written "
                    + totalNumberOfBytesWritten);
                mListener.onStreamCopyError(StreamCopyingThread.this, msg);
            }
        }

        if (numberOfBytesRead == -1 && !mDoStop) {
            Log.d(TAG, "The end of the input stream has been reached (thread ID: "
                + getId() + ", thread name: " + mThreadName + "). Connection data: " + connectionData.toString());
            closeOutputStream();
            mIsInputStreamDone = true;
        } else if (numberOfBytesRead == -1) {
            Log.d(TAG, "Input is closed");
            closeOutputStream();
            mIsInputStreamDone = true;
        }

        Log.d(TAG, "number of bytes read = " + numberOfBytesRead);
        if (mIsInputStreamDone) {
            Log.d(TAG, "onStreamCopyingThreadDone");
            mListener.onStreamCopyingThreadDone(this);
        }

        Log.d(TAG, "Exiting thread (ID: " + getId() + ", name: " + mThreadName
            + "). Connection data: " + connectionData.toString() + " .During the lifetime of the thread the total number of bytes read was "
            + totalNumberOfBytesRead + " and the total number of bytes written "
            + totalNumberOfBytesWritten);
    }

    private void closeOutputStream() {
        Log.d(TAG, "closeOutputStream. Connection data: " + connectionData.toString());
        try {
            Log.d(TAG, "closeOutputStream. Flushing");
            mOutputStream.flush();
        } catch (IOException e) {
            String errorMessage = "Failed to flush output stream";
            Log.e(TAG, errorMessage + " (thread ID: " + getId() + ", thread name: "
                + mThreadName + "): " + e.getMessage());
        }
        try {
            Log.d(TAG, "closeOutputStream. Closing");
            mOutputStream.close();
            Log.d(TAG, "closeOutputStream. Closed");
        } catch (IOException e) {
            String errorMessage = "Failed to close output stream";
            Log.e(TAG, errorMessage + " (thread ID: " + getId() + ", thread name: "
                + mThreadName + "): " + e.getMessage());
            errorMessage += ": " + e.getMessage();
            mListener.onStreamCopyError(StreamCopyingThread.this, errorMessage);
        }
    }

    /**
     * Stops the thread and closes the streams, if not closed already.
     */
    public synchronized void close() {
        Log.i(TAG, "close: Thread ID: " + getId() + ". Connection data: " + connectionData.toString());
        mDoStop = true;

        if (!mIsClosed) {
            try {
                mInputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "closeStreams: Failed to close the input stream (thread ID: "
                    + getId() + ", name: " + mThreadName + "): " + e.getMessage());
            }

            try {
                mOutputStream.close();
            } catch (IOException e) {
                Log.e(TAG, "closeStreams: Failed to close the output stream (thread ID: "
                    + getId() + ", name: " + mThreadName + "): " + e.getMessage());
            }

            Log.d(TAG, "closeStreams: Streams closed (thread ID: "
                + getId() + ", name: " + mThreadName + ")");
            mIsClosed = true;
        } else {
            Log.v(TAG, "closeStreams: Already closed");
        }
    }
}
