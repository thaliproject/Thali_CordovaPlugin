package io.jxcore.node;

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
    ByteArrayOutputStream outgoingOutputStream;
    ListenerMock mListenerMockOutgoing;
    InputStreamMock mInputStreamMockOutgoing;
    OutputStreamMockOutgoing mOutputStreamMockOutgoing;
    OutgoingSocketThreadMock mOutgoingSocketThread;
    String textOutgoing = "Lorem ipsum dolor sit amet elit nibh, imperdiet dignissim, " +
        "imperdiet wisi. Morbi vel risus. Nunc molestie placerat, nulla mi, id nulla ornare " +
        "risus. Sed lacinia, urna eros lacus, elementum eu.";

    final int testPortNumber = 47775;

    ByteArrayOutputStream incomingOutputStream;
    ListenerMock mListenerMockIncoming;
    InputStreamMock mInputStreamMockIncoming;
    OutputStreamMockIncoming mOutputStreamMockIncoming;
    IncomingSocketThreadMock mIncomingSocketThread;
    String textIncoming = "Nullam in massa. Vivamus elit odio, in neque ut congue quis, " +
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
        init();
    }

    private void init() throws Exception {
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
        mInputStreamMockIncoming = new InputStreamMock(textIncoming);
        mOutputStreamMockIncoming = new OutputStreamMockIncoming();
        mListenerMockIncoming = new ListenerMock();
        mIncomingSocketThread =
            new IncomingSocketThreadMock(null, mListenerMockIncoming, mInputStreamMockIncoming,
                mOutputStreamMockIncoming);

    }

    private void initOutgoingSocketThread() throws IOException {
        mInputStreamMockOutgoing = new InputStreamMock(textOutgoing);
        mOutputStreamMockOutgoing = new OutputStreamMockOutgoing();
        mListenerMockOutgoing = new ListenerMock();
        mOutgoingSocketThread =
            new OutgoingSocketThreadMock(null, mListenerMockOutgoing, mInputStreamMockOutgoing,
                mOutputStreamMockOutgoing);

        mExecutor = Executors.newSingleThreadExecutor();
    }

    public Callable<Boolean> createCheckOutgoingSocketThreadStart() {
        return new Callable<Boolean>() {
            int counter = 0;

            @Override
            public Boolean call() {
                while (mOutgoingSocketThread.mServerSocket == null && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e1) {
                        e1.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
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
                    Log.e(mTag, "IncomingSocketThread didn't start after 5s!");
                    return false;
                }
            }
        };
    }


    @Test
    public void testRun() throws Exception {
        Future<Boolean> mFuture;

        try {

            mFuture = startOutgoingSocketThread();

            assertThat("OutgoingSocketThread started", mFuture.get(), is(true));

            mFuture = startIncomingSocketThread();

            assertThat("IncomingSocketThread started", mFuture.get(), is(true));

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

            int attempts = ThaliTestRunner.COUNTER_LIMIT;
            Log.i(this.getClass().getName(), "OutgoingSocketThreadTest");
            while (attempts > 0 && !outgoingOutputStream.toString().equals(textIncoming)) {
                attempts--;
                closeSockets();
                init();
                startOutgoingSocketThread();
                startIncomingSocketThread();
                copyingFinishedLatch.await(5000L, TimeUnit.MILLISECONDS);
                Log.i(mTag, "IncomingSocketThreadTest failed, attempts left " + attempts);
                Log.i(mTag, "outgoingOutputStream.toString() = " + outgoingOutputStream.toString());
                Log.i(mTag, "textIncoming = " + textIncoming);
            }
            if (attempts == 0) {
                assertThat("OutgoingSocketThread should get inputStream from IncomingSocketThread and " +
                        "copy it to local outgoingOutputStream", outgoingOutputStream.toString(),
                    is(equalTo(textIncoming)));
            }


        } finally {
            closeSockets();
            Log.i("!!", " finally closed");
        }
    }

    private Future startOutgoingSocketThread() throws Exception {
        mOutgoingSocketThread.setPort(testPortNumber);
        mIncomingSocketThread.setPort(testPortNumber);

        mOutgoingSocketThread.start(); //Simulate end point to connect to

        return mExecutor.submit(createCheckOutgoingSocketThreadStart());
    }

    private Future startIncomingSocketThread() throws Exception {
        mIncomingSocketThread.start(); //Connect to end point
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
}
