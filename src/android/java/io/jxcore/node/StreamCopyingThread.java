package io.jxcore.node;


import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Created by juksilve on 5.6.2015.
 */
class StreamCopyingThread extends Thread {

    interface CopyThreadCallback{
        void StreamCopyError(StreamCopyingThread who, String error);
    }

    private final CopyThreadCallback callback;
    private boolean mStopped = false;

    private static final int DEFAULT_BUFFER_SIZE = 1024 * 4;

    private final InputStream mInputStream;
    private final  OutputStream mOutputStream;

    public StreamCopyingThread(CopyThreadCallback Callback,InputStream mmInStream,OutputStream mmOutStreamt){
        callback = Callback;
        mInputStream = mmInStream;
        mOutputStream = mmOutStreamt;
    }

    public void run() {
        byte[] buffer = new byte[DEFAULT_BUFFER_SIZE];

        while (!mStopped) {
            try {
                int n = 0;
                while (-1 != (n = mInputStream.read(buffer)) && !mStopped) {
                    //   String dbgMessage = new String(buffer,0,n);
                    //   Log.i (" Copying " + n + " bytes, data: " + dbgMessage);
                    mOutputStream.write(buffer, 0, n);
                }

                if (n == -1) {
                    mStopped = true;
                    callback.StreamCopyError(this, "input stream got -1 on read");
                }

            } catch (IOException e) {
                mStopped = true;
                callback.StreamCopyError(this, "disconnected: " + e.toString());
            }
        }
    }

    public void Stop(){
        mStopped = true;
    }
}
