package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.system.ErrnoException;
import android.system.OsConstants;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.Ignore;
import org.junit.rules.TestRule;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.ServerSocket;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class OutgoingSocketThreadTest {

    static String mTag = OutgoingSocketThreadTest.class.getName();
    private ByteArrayOutputStream outgoingOutputStream;
    private ListenerMock mListenerMockOutgoing;
    private InputStreamMock mInputStreamMockOutgoing;
    private OutputStreamMockOutgoing mOutputStreamMockOutgoing;
    private OutgoingSocketThreadMock mOutgoingSocketThread;
    private String textOutgoing = "Nullam in massa. Vivamus elit odio, in neque ut congue quis, " +
        "venenatis placerat, nulla ornare suscipit, erat urna, pellentesque dapibus vel, " +
        "lorem. Sed egestas non, dolor. Aliquam hendrerit sollicitudin sed.";

    final int testPortNumber = 57775;

    private ByteArrayOutputStream incomingOutputStream;
    private ListenerMock mListenerMockIncoming;
    private InputStreamMock mInputStreamMockIncoming;
    private OutputStreamMockIncoming mOutputStreamMockIncoming;
    private IncomingSocketThreadMock mIncomingSocketThread;
    private String textIncoming = "Lorem ipsum dolor sit amet elit nibh, imperdiet dignissim, " +
        "imperdiet wisi. Morbi vel risus. Nunc molestie placerat, nulla mi, id nulla ornare " +
        "risus. Sed lacinia, urna eros lacus, elementum eu.";

    ExecutorService mExecutor;

    @Rule
    public TestRule watcher = new TestWatcher() {
        protected void starting(Description description) {
            Log.i(mTag, "Starting test: " + description.getMethodName());
        }
    };

    @Before
    public void setUp() throws Exception {
        outgoingOutputStream = new ByteArrayOutputStream();
        incomingOutputStream = new ByteArrayOutputStream();

        mInputStreamMockOutgoing = new InputStreamMock(textOutgoing);
        mOutputStreamMockOutgoing = new OutputStreamMockOutgoing();
        mListenerMockOutgoing = new ListenerMock();
        mOutgoingSocketThread =
            new OutgoingSocketThreadMock(null, mListenerMockOutgoing, mInputStreamMockOutgoing,
                mOutputStreamMockOutgoing);

        mInputStreamMockIncoming = new InputStreamMock(textIncoming);
        mOutputStreamMockIncoming = new OutputStreamMockIncoming();
        mListenerMockIncoming = new ListenerMock();
        mIncomingSocketThread =
            new IncomingSocketThreadMock(null, mListenerMockIncoming, mInputStreamMockIncoming,
                mOutputStreamMockIncoming);

        mExecutor = Executors.newSingleThreadExecutor();
    }

    public Callable<Boolean> createCheckOutgoingSocketThreadStart() {
        return new Callable<Boolean>() {
            int counter = 0;
            @Override
            public Boolean call() {
                while (mOutgoingSocketThread.mServerSocket == null && counter < ThaliTestRunner.counterLimit) {
                    try {
                        Thread.sleep(ThaliTestRunner.timeoutLimit);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.counterLimit) {
                    return true;
                }
                else {
                    Log.e(mTag, "OutgoingSocketThread didn't start after 5s!");
                    return false;
                }
            }
        };
    }

    public Callable<Boolean> createCheckIncomingSocketThreadStart() {
        return new Callable<Boolean>() {
            int counter = 0;
            @Override
            public Boolean call() {
                while (!mIncomingSocketThread.localStreamsCreatedSuccessfully && counter < ThaliTestRunner.counterLimit) {
                    try {
                        Thread.sleep(ThaliTestRunner.timeoutLimit);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.counterLimit) {
                    return true;
                } else {
                    Log.e(mTag, "IncomingSocketThread didn't start after 5s!");
                    return false;
                }
            }
        };
    }

    @Test
    public void testConstructor() throws Exception {
        assertThat("mIncomingSocketThread should not be null", mOutgoingSocketThread,
            is(notNullValue()));
    }

    @Test
    public void testGetListeningOnPortNumber() throws Exception {
        assertThat("getListeningOnPortNumber should be 0",
            mOutgoingSocketThread.getListeningOnPortNumber(), is(equalTo(0)));
    }

    @Test
    public void testClose() throws Exception {
        mOutgoingSocketThread.close();

        Field fServerSocket = mOutgoingSocketThread.getClass().getDeclaredField("mServerSocket");
        fServerSocket.setAccessible(true);
        ServerSocket mServerSocket = (ServerSocket) fServerSocket.get(mOutgoingSocketThread);

        assertThat("mServerSocket should be null", mServerSocket, is(nullValue()));
    }

    // https://github.com/thaliproject/Thali_CordovaPlugin/issues/1214
    // @Test
    public void testRun() throws Exception {
        mOutgoingSocketThread.setPort(testPortNumber);
        mIncomingSocketThread.setPort(testPortNumber);

        mOutgoingSocketThread.start();

        Future<Boolean> mFuture = mExecutor.submit(createCheckOutgoingSocketThreadStart());

        assertThat("OutgoingSocketThread started", mFuture.get(), is(true));

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

        mIncomingSocketThread.start(); //Simulate incoming connection

        mFuture = mExecutor.submit(createCheckIncomingSocketThreadStart());

        assertThat("IncomingSocketThread started", mFuture.get(), is(true));
        assertThat("localStreamsCreatedSuccessfully should be true",
            mOutgoingSocketThread.localStreamsCreatedSuccessfully,
            is(true));

        assertThat("tempInputStream should be equal to mLocalInputStream",
            mOutgoingSocketThread.tempInputStream,
            is(equalTo(mOutgoingSocketThread.mLocalInputStream)));

        assertThat("tempOutputStream should be equal to mLocalOutputStream",
            mOutgoingSocketThread.tempOutputStream,
            is(equalTo(mOutgoingSocketThread.mLocalOutputStream)));

        assertThat("mLocalhostSocket port should be equal to " + testPortNumber,
            mOutgoingSocketThread.mLocalhostSocket.getLocalPort(),
            is(equalTo(testPortNumber)));

        assertThat("OutgoingSocketThread should get inputStream from IncomingSocketThread and " +
                "copy it to local outgoingOutputStream", outgoingOutputStream.toString(),
            is(equalTo(textIncoming)));

        assertThat("IncomingSocketThread should get inputStream from OutgoingSocketThread and " +
                "copy it to local incomingOutputStream", incomingOutputStream.toString(),
            is(equalTo(textOutgoing)));

        try {
            mOutgoingSocketThread.mServerSocket.close();
            mIncomingSocketThread.close();
            mOutgoingSocketThread.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    class OutputStreamMockOutgoing extends OutputStream {
        public boolean isClosed = false;

        @Override
        public void write(int oneByte) throws IOException {
            outgoingOutputStream.write(oneByte);
        }

        @Override
        public void close() throws IOException {
            isClosed = true;
        }
    }

    class OutputStreamMockIncoming extends OutputStream {
        public boolean isClosed = false;

        @Override
        public void write(int oneByte) throws IOException {
            incomingOutputStream.write(oneByte);
        }

        @Override
        public void close() throws IOException {
            isClosed = true;
        }
    }

    class InputStreamMock extends InputStream {
        public boolean isClosed = false;

        ByteArrayInputStream inputStream;

        InputStreamMock(String s) {
            inputStream = new ByteArrayInputStream(s.getBytes());
        }

        @Override
        public int read() throws IOException {
            return inputStream.read();
        }

        @Override
        public int read(byte[] buffer) throws IOException {
            return inputStream.read(buffer);
        }
    }

    @Test
    public void testNoAvailablePorts() throws Exception {
        OutSocketThreadListener listener = new OutSocketThreadListener();
        OutgoingSocketThread outgoingSocketThread = new OutSocketThreadMock(null, listener, null, null);
        outgoingSocketThread.start();
        Thread.sleep(1000L);

        assertThat("We have to get ErrnoException as a cause", listener.exception.getClass().equals(ErrnoException.class));
        assertThat("We have to get ErrnoException with exactly EMFILE code",
            ((ErrnoException) listener.exception).errno,
            is(OsConstants.EMFILE));
    }

    private static class OutSocketThreadMock extends OutgoingSocketThread {

        public OutSocketThreadMock(BluetoothSocket bluetoothSocket,
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

    private class OutSocketThreadListener extends ListenerMock {

        Exception exception;

        @Override
        public void onDisconnected(SocketThreadBase who, Exception exception) {
            this.exception = exception;
        }
    }

}
