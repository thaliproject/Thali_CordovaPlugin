/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

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
            String threadName) {
        mListener = listener;
        mInputStream = inputStream;
        mOutputStream = outputStream;
        mThreadName = threadName;
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
     *
     * Keeps on copying the content of the input stream to the output stream.
     */
    @Override
    public void run() {
        Log.d(TAG, "Entering thread (ID: " + getId() + ", name: " + mThreadName + ")");
        byte[] buffer = new byte[mBufferSize];
        int numberOfBytesRead = 0;

        // Byte counters for debugging
        long totalNumberOfBytesRead = 0;
        long totalNumberOfBytesWritten = 0;

        boolean isFlushing = false;

        try {
            while (!mDoStop && (numberOfBytesRead = mInputStream.read(buffer)) != -1) {
                // Uncomment the logging, if you need to debug the stream copying process.
                // However, note that Log calls are quite heavy and should be used here only, if
                // necessary.
                //Log.d(TAG, "Read " + numberOfBytesRead + " bytes (thread ID: " + getId() + ", thread name: " + mThreadName + ")");
                totalNumberOfBytesRead += numberOfBytesRead;

                mOutputStream.write(buffer, 0, numberOfBytesRead); // Can throw IOException

                isFlushing = true;
                mOutputStream.flush(); // Can throw IOException
                isFlushing = false;

                //Log.d(TAG, "Wrote " + numberOfBytesRead + " bytes (thread ID: " + getId() + ", thread name: " + mThreadName + ")");
                totalNumberOfBytesWritten += numberOfBytesRead;

                if (mNotifyStreamCopyingProgress) {
                    mListener.onStreamCopySucceeded(this, numberOfBytesRead);
                }
            }
        } catch (IOException e) {
            if (!mDoStop) {
                String errorMessage;

                if (isFlushing) {
                    errorMessage = "Failed to flush the output stream";
                } else {
                    errorMessage = "Failed to write to the output stream";
                }

                Log.e(TAG, errorMessage + " (thread ID: " + getId() + ", thread name: "
                        + mThreadName + "): " + e.getMessage());
                errorMessage += ": " + e.getMessage();
                mListener.onStreamCopyError(this, errorMessage);
            }
        }

        if (numberOfBytesRead == -1 && !mDoStop) {
            Log.d(TAG, "The end of the input stream has been reached (thread ID: "
                    + getId() + ", thread name: " + mThreadName + ")");
            closeOutputStream();
            mIsInputStreamDone = true;
        }

        if (mIsInputStreamDone) {
            mListener.onStreamCopyingThreadDone(this);
        }

        Log.d(TAG, "Exiting thread (ID: " + getId() + ", name: " + mThreadName
                + "), during the lifetime of the thread the total number of bytes read was "
                + totalNumberOfBytesRead + " and the total number of bytes written "
                + totalNumberOfBytesWritten);
    }

    private void closeOutputStream(){
        try {
            mOutputStream.flush();
            mOutputStream.close();
        } catch (IOException e) {
            String errorMessage = "Failed to close output stream";
            Log.e(TAG, errorMessage + " (thread ID: " + getId() + ", thread name: "
                + mThreadName + "): " + e.getMessage());
            errorMessage += ": " + e.getMessage();
            mListener.onStreamCopyError(this, errorMessage);
        }
    }

    /**
     * Stops the thread and closes the streams, if not closed already.
     */
    public synchronized void close() {
        Log.i(TAG, "close: Thread ID: " + getId());
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
