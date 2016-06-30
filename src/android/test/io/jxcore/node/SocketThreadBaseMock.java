package io.jxcore.node;

import android.bluetooth.BluetoothSocket;

import java.io.InputStream;
import java.io.OutputStream;

public class SocketThreadBaseMock extends SocketThreadBase {
    public SocketThreadBaseMock(BluetoothSocket bluetoothSocket, Listener listener, InputStream inputStream, OutputStream outputStream) {
        super(bluetoothSocket, listener, inputStream, outputStream);
    }
}
