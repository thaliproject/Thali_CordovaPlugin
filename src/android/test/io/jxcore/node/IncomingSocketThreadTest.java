package io.jxcore.node;

import android.support.annotation.NonNull;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.junit.Before;
import org.junit.Ignore;
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
import java.net.Socket;
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

public class IncomingSocketThreadTest {

    static String mTag = IncomingSocketThreadTest.class.getName();
    private ByteArrayOutputStream outgoingOutputStream;
    private OutgoingSocketThreadMockWithLatch mOutgoingSocketThread;
//    String textOutgoing = "Lorem ipsum dolor sit amet elit nibh, imperdiet dignissim, " +
//            "imperdiet wisi. Morbi vel risus. Nunc molestie placerat, nulla mi, id nulla ornare " +
//            "risus. Sed lacinia, urna eros lacus, elementum eu.";

    private ByteArrayOutputStream incomingOutputStream;
    private IncomingSocketThreadMockWithLatch mIncomingSocketThread;
    private String textIncoming = "Nullam in massa. Vivamus elit odio, in neque ut congue quis, " +
        "venenatis placerat, nulla ornare suscipit, erat urna, pellentesque dapibus vel, " +
        "lorem. Sed egestas non, dolor. Aliquam hendrerit sollicitudin sed.";

    private ExecutorService mExecutor;
    private CountDownLatch copyingFinishedLatch;

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
        // We need to wait
        // until data is copied from incomingMock to local outgoing stream in IncomingSocketThread
        // and from local incoming stream to outgoingMock in OutgoingSocketThread
        copyingFinishedLatch = new CountDownLatch(2);
        initIncomingSocketThread();
        initOutgoingSocketThread();
        mExecutor = Executors.newSingleThreadExecutor();
    }

    private void initIncomingSocketThread() throws IOException {
        InputStream inputStreamMockIncoming = new InputStreamMock(textIncoming);
        OutputStreamMock outputStreamMockIncoming = new OutputStreamMock(incomingOutputStream);
        ListenerMock listenerMockIncoming = new ListenerMock();
        mIncomingSocketThread =
            new IncomingSocketThreadMockWithLatch(null, listenerMockIncoming, inputStreamMockIncoming,
                outputStreamMockIncoming, copyingFinishedLatch);
    }

    private void initOutgoingSocketThread() throws IOException {
        InputStream inputStreamMockOutgoing = new EmptyInputStreamMock();
        OutputStreamMock outputStreamMockOutgoing = new OutputStreamMock(outgoingOutputStream);
        ListenerMock listenerMockOutgoing = new ListenerMock();
        mOutgoingSocketThread =
            new OutgoingSocketThreadMockWithLatch(null, listenerMockOutgoing, inputStreamMockOutgoing,
                outputStreamMockOutgoing, copyingFinishedLatch);
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
                    } catch (InterruptedException e1) {
                        e1.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.counterLimit) {
                    return true;
                } else {
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
        assertThat("mIncomingSocketThread should not be null", mIncomingSocketThread,
            is(notNullValue()));
    }

    @Test
    public void testGetTcpPortNumber() throws Exception {
        Field fTcpPortNumber = mIncomingSocketThread.getClass().getSuperclass().getSuperclass()
            .getDeclaredField("mTcpPortNumber");
        fTcpPortNumber.setAccessible(true);

        int mTcpPortNumber = fTcpPortNumber.getInt(mIncomingSocketThread);

        assertThat("mTcpPortNumber should be equal to getTcpPortNumber", mTcpPortNumber,
            is(equalTo(mIncomingSocketThread.getTcpPortNumber())));
    }

    @Test
    public void testSetTcpPortNumber() throws Exception {
        int tcpPortNumberSample = 1111;
        mIncomingSocketThread.setTcpPortNumber(tcpPortNumberSample);

        assertThat("tcpPortNumber from get method should be equal to tcpPortNumberSample",
            mIncomingSocketThread.getTcpPortNumber(), is(equalTo(tcpPortNumberSample)));
    }

    @Test
    public void testGetLocalHostPort() throws Exception {
        Field fLocalhostSocket = mIncomingSocketThread.getClass().getSuperclass()
            .getSuperclass().getSuperclass().getDeclaredField("mLocalhostSocket");
        fLocalhostSocket.setAccessible(true);
        Socket mLocalhostSocket = (Socket) fLocalhostSocket.get(mIncomingSocketThread);

        if (mLocalhostSocket == null) {
            assertThat("getLocalHostPort should return 0 if mLocalhostSocket is not null",
                mIncomingSocketThread.getLocalHostPort(), is(0));
        } else {
            assertThat("getLocalHostPort should return null if mLocalhostSocket is null",
                mIncomingSocketThread.getLocalHostPort(), is(nullValue()));
        }
    }
    //@Ignore("#1214")
    //@Test
    public void testRun() throws Exception {
        Future<Boolean> future;
        int testPortNumber = 47775;
        mOutgoingSocketThread.setPort(testPortNumber);
        mIncomingSocketThread.setPort(testPortNumber);
        try {
            mOutgoingSocketThread.start(); //Simulate end point to connect to

            future = mExecutor.submit(createCheckOutgoingSocketThreadStart());

            assertThat("OutgoingSocketThread started", future.get(), is(true));

            mIncomingSocketThread.start(); //Connect to end point
            future = mExecutor.submit(createCheckIncomingSocketThreadStart());

            assertThat("IncomingSocketThread started", future.get(), is(true));

            assertThat("localStreamsCreatedSuccessfully should be true",
                mIncomingSocketThread.localStreamsCreatedSuccessfully,
                is(true));

            assertThat("tempInputStream should be equal to mLocalInputStream",
                mIncomingSocketThread.tempInputStream,
                is(equalTo(mIncomingSocketThread.mLocalInputStream)));

            assertThat("tempOutputStream should be equal to mLocalOutputStream",
                mIncomingSocketThread.tempOutputStream,
                is(equalTo(mIncomingSocketThread.mLocalOutputStream)));

            assertThat("mLocalhostSocket port should be equal to " + testPortNumber,
                mIncomingSocketThread.mLocalhostSocket.getPort(),
                is(equalTo(testPortNumber)));

            copyingFinishedLatch.await(5000L, TimeUnit.MILLISECONDS);

            assertThat("OutgoingSocketThread should get inputStream from IncomingSocketThread and " +
                    "copy it to local outgoingOutputStream", outgoingOutputStream.toString(),
                is(equalTo(textIncoming)));
            // We couldn't get the data simultaneously because we close socket after get -1
            // So when we transmit our textIncoming we couldn't get textOutgoing in incomingOutputStream
            // because that socket(incomingInputStream, incomingOutputStream) is already closed

//            assertThat("IncomingSocketThread should get inputStream from OutgoingSocketThread and " +
//                    "copy it to local incomingOutputStream", incomingOutputStream.toString(),
//                is(equalTo(textOutgoing)));
        } finally {
            if (mOutgoingSocketThread.mServerSocket != null) {
                mOutgoingSocketThread.mServerSocket.close();
            }
            mIncomingSocketThread.close();
            mOutgoingSocketThread.close();
            Log.i("!!", " finally closed");
        }
    }

    private class OutputStreamMock extends OutputStream {

        public boolean isClosed = false;

        private OutputStream outputStream;

        OutputStreamMock(OutputStream outputStream) {
            this.outputStream = outputStream;
        }

        @Override
        public void write(int oneByte) throws IOException {
            outputStream.write(oneByte);
        }

        @Override
        public void close() throws IOException {
            isClosed = true;
        }
    }

    private class InputStreamMock extends InputStream {

        public boolean isClosed = false;

        ByteArrayInputStream inputStream;

        InputStreamMock(String s) {
            inputStream = new ByteArrayInputStream(s.getBytes());
        }

        @Override
        public int read() throws IOException {
            return inputStream.read();
        }

    }

    private class EmptyInputStreamMock extends InputStream {

        @Override
        public int read() throws IOException {
            return 0;
        }

    }
}
