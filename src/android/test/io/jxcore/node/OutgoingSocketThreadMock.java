package io.jxcore.node;

import android.bluetooth.BluetoothSocket;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class OutgoingSocketThreadMock  extends OutgoingSocketThread {
    public Long threadId;
    public boolean closeCalled = false;

    public OutgoingSocketThreadMock(BluetoothSocket bluetoothSocket, Listener listener,
                                    InputStream inputStream, OutputStream outputStream) throws IOException {
        super(bluetoothSocket, listener, inputStream, outputStream);
    }

    @Override
    public void close() {
        closeCalled = true;
    }

    @Override
    public long getId() {
        return threadId;
    }
}
