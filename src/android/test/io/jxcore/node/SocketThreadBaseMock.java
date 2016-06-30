package io.jxcore.node;

import android.bluetooth.BluetoothSocket;

<<<<<<< HEAD
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;

public class SocketThreadBaseMock extends SocketThreadBase {
    public SocketThreadBaseMock(BluetoothSocket bluetoothSocket, Listener listener,
                                InputStream inputStream, OutputStream outputStream)
            throws IOException {
        super(bluetoothSocket, listener, inputStream, outputStream);
        mTag = SocketThreadBaseMock.class.getName();
=======
import java.io.InputStream;
import java.io.OutputStream;

public class SocketThreadBaseMock extends SocketThreadBase {
    public SocketThreadBaseMock(BluetoothSocket bluetoothSocket, Listener listener, InputStream inputStream, OutputStream outputStream) {
        super(bluetoothSocket, listener, inputStream, outputStream);
>>>>>>> fbe3556f403db9ec8bd6308c2e1459f059cf7c89
    }
}
