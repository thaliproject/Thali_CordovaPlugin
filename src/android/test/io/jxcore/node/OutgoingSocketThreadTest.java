package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.system.ErrnoException;
import android.system.OsConstants;
import android.util.Log;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.ServerSocket;
import java.net.SocketException;
import java.util.concurrent.Semaphore;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class OutgoingSocketThreadTest {

    ListenerMock mListenerMock;
    InputStreamMock mInputStreamMock;
    OutputStreamMock mOutputStreamMock;
    OutgoingSocketThread mOutgoingSocketThread;

    @Before
    public void setUp() throws Exception {
        mInputStreamMock = new InputStreamMock();
        mOutputStreamMock = new OutputStreamMock();
        mListenerMock = new ListenerMock();
        mOutgoingSocketThread = new OutgoingSocketThread(null, mListenerMock, mInputStreamMock, mOutputStreamMock);
    }

    @Test
    public void testConstructor() throws Exception {
        assertThat("mIncomingSocketThread should not be null", mOutgoingSocketThread, is(notNullValue()));
    }

    @Test
    public void testGetListeningOnPortNumber() throws Exception {
        assertThat("getListeningOnPortNumber should be 0", mOutgoingSocketThread.getListeningOnPortNumber(), is(equalTo(0)));
    }

    @Test
    public void testClose() throws Exception {
        mOutgoingSocketThread.close();

        Field fServerSocket = mOutgoingSocketThread.getClass().getDeclaredField("mServerSocket");
        fServerSocket.setAccessible(true);
        ServerSocket mServerSocket = (ServerSocket) fServerSocket.get(mOutgoingSocketThread);

        assertThat("mServerSocket should be null", mServerSocket, is(nullValue()));
    }

    @Test
    public void testRun() throws Exception {
        System.out.println("Running OutgoingSocketThread");
        mOutgoingSocketThread.start();

        Thread.sleep(1000); //Wait for thread to start

        Field fServerSocket = mOutgoingSocketThread.getClass().getDeclaredField("mServerSocket");
        Field fListeningOnPortNumber = mOutgoingSocketThread.getClass()
            .getDeclaredField("mListeningOnPortNumber");

        fServerSocket.setAccessible(true);
        fListeningOnPortNumber.setAccessible(true);

        ServerSocket mServerSocket = (ServerSocket) fServerSocket.get(mOutgoingSocketThread);
        int mListeningOnPortNumber = fListeningOnPortNumber.getInt(mOutgoingSocketThread);

        assertThat("mServerSocket should not be null", mServerSocket, is(notNullValue()));
        assertThat("mListeningOnPortNumber should be equal to mServerSocket.getLocalPort()",
            mListeningOnPortNumber, is(equalTo(mServerSocket.getLocalPort())));
        assertThat("mServerSocket.isBound should return true", mServerSocket.isBound(),
            is(true));
        //TODO Simulate incoming connection
    }

    @Test
    public void testNoAvailablePorts() throws Exception {
        OutgoingSocketThreadListener listener = new OutgoingSocketThreadListener();
        OutgoingSocketThread outgoingSocketThread = new OutgoingSocketThreadMock(null, listener, null, null);
        outgoingSocketThread.start();
        Thread.sleep(1000L);

        assertThat("We have to get ErrnoException as a cause", listener.exception.getClass().equals(ErrnoException.class));
        assertThat("We have to get ErrnoException with exactly EMFILE code",
            ((ErrnoException) listener.exception).errno,
            is(OsConstants.EMFILE));
    }

    private static class OutgoingSocketThreadMock extends OutgoingSocketThread {

        public OutgoingSocketThreadMock(BluetoothSocket bluetoothSocket,
                                        Listener listener,
                                        InputStream inputStream,
                                        OutputStream outputStream)
            throws IOException {
            super(bluetoothSocket, listener, inputStream, outputStream);
        }

        @Override
        public void run() {
            mListener.onDisconnected(this, new ErrnoException("run", OsConstants.EMFILE));
        }
    }

    private class OutgoingSocketThreadListener extends ListenerMock {

        Exception exception;

        @Override
        public void onDisconnected(SocketThreadBase who, Exception exception) {
            this.exception = exception;
        }
    }

}
