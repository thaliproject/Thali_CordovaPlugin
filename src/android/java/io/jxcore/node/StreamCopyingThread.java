package io.jxcore.node;

import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Created by juksilve on 5.6.2015.
 */
public class StreamCopyingThread extends Thread {


    interface CopyThreadCallback
    {
        public void StreamCopyError(StreamCopyingThread who, String error);
    }

    CopyThreadCallback callback = null;

    String TAG = "StreamCopyingThread";
    boolean mStopped = false;

    private static final int DEFAULT_BUFFER_SIZE = 1024 * 4;

    private InputStream mInputStream = null;
    private OutputStream mOutputStream = null;

    public StreamCopyingThread(CopyThreadCallback Callback,InputStream mmInStream,OutputStream mmOutStreamt){
        callback = Callback;
        mInputStream = mmInStream;
        mOutputStream = mmOutStreamt;
    }

    public void setStreams(InputStream mmInStream,OutputStream mmOutStreamt){
        mInputStream = mmInStream;
        mOutputStream = mmOutStreamt;
    }

    public void setDebugTag(String debugtag) {
        TAG = debugtag;
    }

    public void run() {
        byte[] buffer = new byte[DEFAULT_BUFFER_SIZE];

        while (!mStopped){
            try {
                if (!mStopped) {
                    if (mInputStream != null && mOutputStream != null) {
                        int n = 0;
                        while (-1 != (n = mInputStream.read(buffer)) && !mStopped) {
                            String dbgMessage = new String(buffer,0,n);
                            print_debug(" Copying " + n + " bytes, data: " + dbgMessage);
                            mOutputStream.write(buffer, 0, n);
                        }

                        if(n == -1){
                            mStopped = true;
                            callback.StreamCopyError(this, "input stream got -1 on read");
                        }
                    }
                }
            } catch (IOException e) {
                if (!mStopped) {
                    mStopped = true;
                    callback.StreamCopyError(this, "disconnected: " + e.toString());
                }
            }
        }

        print_debug("run ended");
    }

    public void Stop(){
        mStopped = true;
    }

    public void print_debug(String message){
        Log.i(TAG, message);
    }
}
