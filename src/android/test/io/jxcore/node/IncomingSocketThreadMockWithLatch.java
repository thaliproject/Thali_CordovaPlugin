package io.jxcore.node;


import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;

public class IncomingSocketThreadMockWithLatch extends IncomingSocketThreadMock {

    private CountDownLatch copyingFinishedLatch;

    public IncomingSocketThreadMockWithLatch(BluetoothSocket bluetoothSocket, Listener listener,
                                             InputStream inputStream, OutputStream outputStream,
                                             CountDownLatch copyingLatch) throws IOException {
        super(bluetoothSocket, listener, inputStream, outputStream);
        copyingFinishedLatch = copyingLatch;
    }

    @Override
    public void onStreamCopyingThreadDone(StreamCopyingThread who) {
        Log.e("!!", "countdown!");
        copyingFinishedLatch.countDown();
    }
}
