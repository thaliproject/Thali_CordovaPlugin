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
         * Called when copying the content fails. If this error occurs, the thread is exited.
         * @param who The thread, which failed.
         * @param errorMessage The error message.
         */
        void onStreamCopyError(StreamCopyingThread who, String errorMessage);

        /**
         * Called when a block of bytes (identified by the given number) is read and written successfully.
         * @param who The thread, which succeeded in reading and writing.
         * @param numberOfBytes The number of bytes read and written.
         */
        void onStreamCopySucceeded(StreamCopyingThread who, int numberOfBytes);
    }

    private static final String TAG = StreamCopyingThread.class.getName();
    private static final int DEFAULT_BUFFER_SIZE = 1024 * 4;
    private final Listener mListener;
    private final InputStream mInputStream;
    private final OutputStream mOutputStream;
    private final String mThreadName;
    private boolean mDoStop = false;

    /**
     * Constructor.
     * @param listener The listener.
     * @param inputStream The input stream.
     * @param outputStream The output stream.
     * @param threadName The name for the thread so it can be easily identified from the logs.
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

    /**
     * From Thread.
     *
     * Keeps on copying the content of the input stream to the output stream.
     */
    @Override
    public void run() {
        Log.i(TAG, "Entering thread (ID: " + getId() + ", name: " + mThreadName + ")");
        byte[] buffer = new byte[DEFAULT_BUFFER_SIZE];

        while (!mDoStop) {
            try {
                int numberOfBytesRead = 0;

                while ((numberOfBytesRead = mInputStream.read(buffer)) != -1 && !mDoStop) {
                    Log.i(TAG, "Read " + numberOfBytesRead + " bytes (thread ID: "
                            + getId() + ", thread name: " + mThreadName + ")");

                    mOutputStream.write(buffer, 0, numberOfBytesRead); // Can throw IOException

                    Log.i(TAG, "Wrote " + numberOfBytesRead + " bytes (thread ID: "
                            + getId() + ", thread name: " + mThreadName + ")");
                    mListener.onStreamCopySucceeded(this, numberOfBytesRead);
                }

                if (numberOfBytesRead == -1) {
                    Log.e(TAG, "Input stream got -1 on read (thread ID: "
                            + getId() + ", thread name: " + mThreadName + ")");
                    mDoStop = true;
                    mListener.onStreamCopyError(this, "Input stream got -1 on read");
                }
            } catch (IOException e) {
                Log.w(TAG, "Either failed to read from the output stream or write to the input stream (thread ID: "
                        + getId() + ", thread name: " + mThreadName + "): " + e.getMessage());
                mDoStop = true;
                mListener.onStreamCopyError(this, "Either failed to read from the output stream or write to the input stream: " + e.getMessage());
            }
        }

        Log.i(TAG, "Exiting thread (ID: " + getId() + ", name: " + mThreadName + ")");
    }

    /**
     * Stops the thread.
     */
    public void doStop() {
        Log.i(TAG, "doStop: Thread ID: " + getId());
        mDoStop = true;
    }
}
