package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.system.ErrnoException;
import android.system.OsConstants;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class OutgoingSocketThreadTest {

    private final static String TAG = OutgoingSocketThreadTest.class.getName();
    private ByteArrayOutputStream outgoingOutputStream;
    private OutgoingSocketThreadMock mOutgoingSocketThread;
    private CountDownLatch copyingFinishedLatch;
    private String textOutgoing = "Nullam in massa. Vivamus elit odio, in neque ut congue quis, " +
        "venenatis placerat, nulla ornare suscipit, erat urna, pellentesque dapibus vel, " +
        "lorem. Sed egestas non, dolor. Aliquam hendrerit sollicitudin sed.";

    private final int testPortNumber = 57775;

    private ByteArrayOutputStream incomingOutputStream;
    private IncomingSocketThreadMock mIncomingSocketThread;
    private String textIncoming = "Lorem ipsum dolor sit amet elit nibh, imperdiet dignissim, " +
        "imperdiet wisi. Morbi vel risus. Nunc molestie placerat, nulla mi, id nulla ornare " +
        "risus. Sed lacinia, urna eros lacus, elementum eu.";

    private ExecutorService mExecutor;

    @Rule
    public TestRule watcher = new TestWatcher() {
        protected void starting(Description description) {
            Log.i(TAG, "Starting test: " + description.getMethodName());
        }
    };

    @Before
    public void setUp() throws Exception {
        initDependencies();
    }

    private void initDependencies() throws Exception {
        outgoingOutputStream = new ByteArrayOutputStream();
        incomingOutputStream = new ByteArrayOutputStream();
        // See comment in IncomingSocketThreadTest init
        copyingFinishedLatch = new CountDownLatch(2);
        initOutgoingSocketThread();
        initIncomingSocketThread();

        mExecutor = Executors.newSingleThreadExecutor();
    }

    private void initOutgoingSocketThread() throws IOException {
        InputStreamMock inputStream = new InputStreamMock(textOutgoing);
        OutputStreamMock outputStream = new OutputStreamMock(outgoingOutputStream);
        ListenerMock listenerOutgoing = new ListenerMock();
        mOutgoingSocketThread = new OutgoingSocketThreadMock(null, listenerOutgoing, inputStream,
            outputStream);
    }

    private void initIncomingSocketThread() throws IOException {
        InputStream inputStream = new EmptyInputStreamMock();
        OutputStreamMock outputStream = new OutputStreamMock(incomingOutputStream);
        ListenerMock listenerIncoming = new ListenerMock();
        mIncomingSocketThread = new IncomingSocketThreadMock(null, listenerIncoming, inputStream,
            outputStream);
    }

    private Callable<Boolean> createCheckOutgoingSocketThreadStart() {
        return new Callable<Boolean>() {
            int counter = 0;

            @Override
            public Boolean call() {
                while (mOutgoingSocketThread.mServerSocket == null && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(TAG, "OutgoingSocketThread didn't start after 5s!");
                    return false;
                }
            }
        };
    }

    private Callable<Boolean> createCheckIncomingSocketThreadStart() {
        return new Callable<Boolean>() {
            int counter = 0;

            @Override
            public Boolean call() {
                while (!mIncomingSocketThread.localStreamsCreatedSuccessfully && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(TAG, "IncomingSocketThread didn't start after 5s!");
                    return false;
                }
            }
        };
    }

    @Test
    public void testClose() throws Exception {
        mOutgoingSocketThread.close();
        ServerSocket serverSocket = getServerSocket();
        assertThat("mServerSocket should be null", serverSocket, is(nullValue()));
    }

    @Test
    public void testRun() throws Exception {
        try {
            Future<Boolean> startThreadFuture = startOutgoingSocketThread();
            assertThat("OutgoingSocketThread started", startThreadFuture.get(), is(true));
            int port = checkServerSocket();
            checkListeningPort(port);

            startThreadFuture = startIncomingSocketThread();
            assertThat("IncomingSocketThread started", startThreadFuture.get(), is(true));
            checkStreams();
            copyingFinishedLatch.await(5000L, TimeUnit.MILLISECONDS);
            int attempts = ThaliTestRunner.COUNTER_LIMIT;
            Log.i(TAG, "OutgoingSocketThreadTest");
            while (attempts > 0 && (!incomingOutputStream.toString().equals(textOutgoing))) {
                attempts--;
                closeSockets();
                initDependencies();
                startOutgoingSocketThread();
                startIncomingSocketThread();
                copyingFinishedLatch.await(5000L, TimeUnit.MILLISECONDS);
                Log.i(TAG, "OutgoingSocketThreadTest failed, attempts left " + attempts);
                Log.i(TAG, "incomingOutputStream = " + incomingOutputStream.toString());
                Log.i(TAG, "textOutgoing= " + textOutgoing);
            }
            if (attempts == 0) {
                assertThat("IncomingSocketThread should get inputStream from OutgoingSocketThread and " +
                        "copy it to local incomingOutputStream", incomingOutputStream.toString(),
                    is(equalTo(textOutgoing)));
            }
        } finally {
            closeSockets();
        }
    }

    private Future<Boolean> startOutgoingSocketThread() throws Exception {
        mOutgoingSocketThread.setPort(testPortNumber);
        mIncomingSocketThread.setPort(testPortNumber);
        mOutgoingSocketThread.start();
        return mExecutor.submit(createCheckOutgoingSocketThreadStart());
    }

    private Future<Boolean> startIncomingSocketThread() throws Exception {
        mIncomingSocketThread.start(); //Simulate incoming connection
        return mExecutor.submit(createCheckIncomingSocketThreadStart());
    }

    private void closeSockets() {
        try {
            if (mOutgoingSocketThread.mServerSocket != null) {
                mOutgoingSocketThread.mServerSocket.close();
            }
            mIncomingSocketThread.close();
            mOutgoingSocketThread.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private int checkServerSocket() throws NoSuchFieldException, IllegalAccessException {
        ServerSocket serverSocket = getServerSocket();
        assertThat("mServerSocket should not be null", serverSocket, is(notNullValue()));
        assertThat("mServerSocket.isBound should return true", serverSocket.isBound(), is(true));
        return serverSocket.getLocalPort();
    }

    private void checkListeningPort(int port) throws NoSuchFieldException, IllegalAccessException {
        Field fListeningOnPortNumber = mOutgoingSocketThread.getClass()
            .getDeclaredField("mListeningOnPortNumber");
        fListeningOnPortNumber.setAccessible(true);
        int listeningOnPortNumber = fListeningOnPortNumber.getInt(mOutgoingSocketThread);
        assertThat("mListeningOnPortNumber should be equal to mServerSocket.getLocalPort()",
            listeningOnPortNumber, is(equalTo(port)));
    }

    private void checkStreams() {
        assertThat("localStreamsCreatedSuccessfully should be true",
            mOutgoingSocketThread.localStreamsCreatedSuccessfully, is(true));
        assertThat("tempInputStream should be equal to localInputStream",
            mOutgoingSocketThread.tempInputStream,
            is(equalTo(mOutgoingSocketThread.mLocalInputStream)));
        assertThat("tempOutputStream should be equal to localOutputStream",
            mOutgoingSocketThread.tempOutputStream,
            is(equalTo(mOutgoingSocketThread.mLocalOutputStream)));
        assertThat("localhostSocket port should be equal to " + testPortNumber,
            mOutgoingSocketThread.mLocalhostSocket.getLocalPort(), is(equalTo(testPortNumber)));
    }

    private ServerSocket getServerSocket() throws NoSuchFieldException, IllegalAccessException {
        Field fServerSocket = mOutgoingSocketThread.getClass().getDeclaredField("mServerSocket");
        fServerSocket.setAccessible(true);
        return (ServerSocket) fServerSocket.get(mOutgoingSocketThread);
    }

    private class OutputStreamMock extends OutputStream {

        private OutputStream outputStream;

        OutputStreamMock(OutputStream outputStream) {
            this.outputStream = outputStream;
        }

        @Override
        public void write(int oneByte) throws IOException {
            outputStream.write(oneByte);
        }
    }

    private static class InputStreamMock extends InputStream {

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

    private static class EmptyInputStreamMock extends InputStream {
        @Override
        public int read() throws IOException {
            return 0;
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

        OutSocketThreadMock(BluetoothSocket bluetoothSocket,
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

    private static class OutSocketThreadListener extends ListenerMock {

        Exception exception;

        @Override
        public void onDisconnected(SocketThreadBase who, Exception exception) {
            this.exception = exception;
        }
    }

}
