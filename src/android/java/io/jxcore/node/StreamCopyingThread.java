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
    }

    private static final String TAG = StreamCopyingThread.class.getName();
    private static final int DEFAULT_BUFFER_SIZE = 1024 * 4;
    private final Listener mListener;
    private final InputStream mInputStream;
    private final OutputStream mOutputStream;
    private boolean mDoStop = false;

    /**
     * Constructor.
     * @param listener The listener.
     * @param inputStream The input stream.
     * @param outputStream The output stream.
     */
    public StreamCopyingThread(Listener listener, InputStream inputStream, OutputStream outputStream) {
        mListener = listener;
        mInputStream = inputStream;
        mOutputStream = outputStream;
    }

    /**
     * From Thread.
     *
     * Keeps on copying the content of the input stream to the output stream.
     */
    @Override
    public void run() {
        byte[] buffer = new byte[DEFAULT_BUFFER_SIZE];

        while (!mDoStop) {
            try {
                int numberOfBytesRead = 0;

                while (-1 != (numberOfBytesRead = mInputStream.read(buffer)) && !mDoStop) {
                    Log.i(TAG, "Read " + numberOfBytesRead + " bytes");
                    mOutputStream.write(buffer, 0, numberOfBytesRead);
                }

                if (numberOfBytesRead == -1) {
                    Log.e(TAG, "Input stream got -1 on read");
                    mDoStop = true;
                    mListener.onStreamCopyError(this, "Input stream got -1 on read");
                }
            } catch (IOException e) {
                Log.w(TAG, "onDisconnected: " + e.getMessage());
                mDoStop = true;
                mListener.onStreamCopyError(this, "onDisconnected: " + e.getMessage());
            }
        }
    }

    /**
     * Stops the thread.
     */
    public void doStop() {
        mDoStop = true;
    }
}
