package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;

public class OutgoingSocketThreadMockWithLatch extends OutgoingSocketThreadMock {

    private CountDownLatch copyingFinishedLatch;

    public OutgoingSocketThreadMockWithLatch(BluetoothSocket bluetoothSocket, Listener listener,
                                             InputStream inputStream, OutputStream outputStream, CountDownLatch copyingLatch)
            throws IOException {
        super(bluetoothSocket, listener, inputStream, outputStream);
        copyingFinishedLatch = copyingLatch;
    }

    @Override
    public void onStreamCopyingThreadDone(StreamCopyingThread who) {
        Log.e("!!", "countdown outgoing!");
        copyingFinishedLatch.countDown();
    }
}
