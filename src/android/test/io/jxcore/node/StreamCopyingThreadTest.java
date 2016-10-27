package io.jxcore.node;

import android.content.Context;
import android.util.Log;

import org.junit.Assert;
import com.test.thalitest.ThaliTestRunner;

import org.junit.Before;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import org.junit.rules.TestRule;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Random;
import java.util.Arrays;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.MatcherAssert.assertThat;

public class StreamCopyingThreadTest {

    StreamCopyingThread mStreamCopyingThread;
    StreamCopyingThread.Listener mListener;
    Context mContext;
    InputStream mInputStream;
    OutputStream mOutputStream;
    String mThreadName = "My test thread name";
    String mResult;
    String mText = "TestingText";
    String lastExceptionMessage = "";
    int bufferLength = 0;
    ByteArrayOutputStream bOutputStream;
    static ArrayList<Integer> notifications;
    boolean doThrowException = false;
    final static String mTag = "StreamCopyingThreadTest";
    static ExecutorService mExecutor;

    public Callable<Boolean> createCheckStreamCopyingThreadIsClosed() {

        return new Callable<Boolean>() {
            int counter = 0;

            @Override
            public Boolean call() {
                boolean mIsClosed = false;
                Field fIsClosed;

                try {
                    fIsClosed = mStreamCopyingThread.getClass().getDeclaredField("mIsClosed");
                    fIsClosed.setAccessible(true);
                } catch (NoSuchFieldException e) {
                    e.printStackTrace();
                    return false;
                }

                while (!mIsClosed && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                        mIsClosed = fIsClosed.getBoolean(mStreamCopyingThread);
                    } catch (InterruptedException | IllegalAccessException e) {
                        e.printStackTrace();
                        return false;
                    }
                }

                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(mTag, "StreamCopyingThread didn't close after 5s!");
                    return false;
                }
            }
        };
    }

    @Rule
    public ExpectedException thrown = ExpectedException.none();

    @Rule
    public TestRule watcher = new TestWatcher() {
        protected void starting(Description description) {
            Log.i(mTag, "Starting test: " + description.getMethodName());
        }
    };

    @Before
    public void setUp() throws Exception {
        mResult = "Lorem ipsum dolor sit.";
        notifications = new ArrayList<>();

        mContext = jxcore.activity.getBaseContext();
        mListener = new ListenerMock();

        bOutputStream = new ByteArrayOutputStream();
        mInputStream = new StreamCopyingThreadInputStream(mResult);
        mOutputStream = new StreamCopyingThreadOutputStream(bOutputStream);

        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
<<<<<<< f67220e6fe2c43eb715b189e362bbfa2a1647bcc
            mThreadName, new ConnectionData(new PeerProperties(), false));
        mExecutor = Executors.newSingleThreadExecutor();
||||||| merged common ancestors
            mThreadName, new ConnectionData(new PeerProperties(), false));
=======
                mThreadName, new ConnectionData(new PeerProperties(), false), true);
>>>>>>> added logs
    }

    @Test
    public void testSetBufferSize() throws Exception {
        Field mBufferSizeField = mStreamCopyingThread.getClass().getDeclaredField("mBufferSize");
        mBufferSizeField.setAccessible(true);

        mStreamCopyingThread.setBufferSize(512 * 8);

        assertThat("The mBufferSize is properly set",
            mBufferSizeField.getInt(mStreamCopyingThread),
            is(512 * 8));

        thrown.expect(IllegalArgumentException.class);
        mStreamCopyingThread.setBufferSize(0);

        thrown.expect(IllegalArgumentException.class);
        mStreamCopyingThread.setBufferSize(1024 * 8 + 1);
    }

    @Ignore("https://github.com/thaliproject/Thali_CordovaPlugin/issues/1528")
    @Test
    public void testRun() throws Exception {
        mResult = "";
        bOutputStream = new ByteArrayOutputStream();
        mInputStream = new StreamCopyingThreadInputStreamInfinite(mText);
        mOutputStream = new StreamCopyingThreadOutputStreamInfinite();
<<<<<<< f67220e6fe2c43eb715b189e362bbfa2a1647bcc
        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
            mThreadName, new ConnectionData(new PeerProperties(), false));
||||||| merged common ancestors
        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream, mThreadName,
            new ConnectionData(new PeerProperties(), false));
=======
        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream, mThreadName,
                new ConnectionData(new PeerProperties(), false), true);
>>>>>>> added logs


        mStreamCopyingThread.start();

        Future<Boolean> mFuture = mExecutor.submit(createCheckStreamCopyingThreadIsClosed());

        assertThat("StreamCopyingThread should be closed", mFuture.get(), is(true));
        assertThat("The content of the input stream is equal to the output stream",
            bOutputStream.toString(),
            is(mResult));
    }

    @Test
    public void testRunWithException() throws Exception {
        doThrowException = true;
        StreamCopyingThread streamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
<<<<<<< f67220e6fe2c43eb715b189e362bbfa2a1647bcc
            mThreadName, new ConnectionData(new PeerProperties(), false));
||||||| merged common ancestors
                mThreadName, new ConnectionData(new PeerProperties(), false));
=======
                mThreadName, new ConnectionData(new PeerProperties(), false), true);
>>>>>>> added logs
        Thread runner = new Thread(streamCopyingThread);
        runner.setName("thread test");
        runner.start();
        runner.join();

        doThrowException = false;

        assertThat("The exception is properly handled.",
            lastExceptionMessage,
            is("Failed to write to the output stream: Test exception."));
    }

    @Test
    public void testRunNotify() throws Exception {
        mStreamCopyingThread.setNotifyStreamCopyingProgress(true);
        Thread runner = new Thread(mStreamCopyingThread);
        runner.start();
        runner.join();

        assertThat("The content of the input stream is equal to the output stream",
            bOutputStream.toString(),
            is(mResult));

        assertThat("The stream copying progress notifications is properly updated",
<<<<<<< f67220e6fe2c43eb715b189e362bbfa2a1647bcc
            notifications.size() > 0,
            is(true));
||||||| merged common ancestors
            notifications.size() > 0,
            is(true));

        notifications.size();
=======
                notifications.size() > 0,
                is(true));

        notifications.size();
>>>>>>> added logs
    }

    @Test
    public void testCopyBigData() throws InterruptedException {

        byte[] data = new byte[20 * 1024 * 1024];
        Arrays.fill(data, (byte) 19);
        String threadName = "testCopyBigData thread";

        ByteArrayOutputStream bOutputStream = new ByteArrayOutputStream();
        InputStream inputStream = new StreamCopyingThreadInputStream(data);
        OutputStream outputStream = new StreamCopyingThreadOutputStream(bOutputStream);

        StreamCopyingThread streamCopyingThread = new StreamCopyingThread(mListener, inputStream, outputStream,
                threadName, new ConnectionData(new PeerProperties(), false), true);

        Thread runner = new Thread(streamCopyingThread);
        runner.start();
        runner.join();

        assertThat("The content of the input stream is equal to the output stream",
                bOutputStream.toByteArray(),
                is(data));
    }


    @Test
    public void testCopyDataAndCloseConnection() throws InterruptedException, IOException {
        int dataSize = 20 * 1024 * 1024;
        byte[] data = new byte[dataSize];
        Arrays.fill(data, (byte) 19);
        String threadName = "testCopyDataAndCloseConnection thread";

        ByteArrayOutputStream bOutputStream = new ByteArrayOutputStream();
        final InputStream inputStream = new StreamCopyingThreadInputStream(data);
        OutputStream outputStream = new StreamCopyingThreadOutputStream(bOutputStream);
        ListenerMock listenerMock = new ListenerMock(new OnHalfStreamCopiedListener() {
            @Override
            public void onHalfStreamCopied() {
                try {
                    Log.i("testCopyDataAndClose", "closing input stream");
                    inputStream.close();
                } catch (IOException e) {
                    Assert.fail("IOException while closing stream");
                }
            }
        }, dataSize / 2);
        StreamCopyingThread streamCopyingThread = new StreamCopyingThread(listenerMock, inputStream, outputStream,
                threadName, new ConnectionData(new PeerProperties(), false), true);
        streamCopyingThread.setNotifyStreamCopyingProgress(true);
        Thread runner = new Thread(streamCopyingThread);
        runner.start();
        runner.join();

        assertThat("The content of the input stream is equal to the output stream",
                bOutputStream.toByteArray(),
                is(data));
        //We can't write to stream and get the IOException because ByteArrayOutputStream does nothing in close
        assertThat("Closing input stream closes output stream",
                ((StreamCopyingThreadOutputStream) outputStream).isCloseCalled,
                is(true));

    }

    interface OnHalfStreamCopiedListener {
        void onHalfStreamCopied();
    }

    class ListenerMock implements StreamCopyingThread.Listener {

        OnHalfStreamCopiedListener onHalfStreamCopiedListener;
        private int halfOfStreamData;
        private long totalBytesRead;
        private boolean halfCopiedCalled = false;

        public ListenerMock(OnHalfStreamCopiedListener onHalfStreamCopiedListener, int halfOfStreamData) {
            this.onHalfStreamCopiedListener = onHalfStreamCopiedListener;
            this.halfOfStreamData = halfOfStreamData;
        }

        public ListenerMock() {
        }

        @Override
        public void onStreamCopyError(StreamCopyingThread who, String errorMessage) {
            lastExceptionMessage = errorMessage;
        }

        @Override
        public void onStreamCopySucceeded(StreamCopyingThread who, int numberOfBytes) {
            notifications.add(numberOfBytes);
            totalBytesRead += numberOfBytes;
            if (onHalfStreamCopiedListener != null) {
                if (!halfCopiedCalled && totalBytesRead >= halfOfStreamData) {
                    Log.w("!!", "call onHalfStreamCopied");
                    onHalfStreamCopiedListener.onHalfStreamCopied();
                    halfCopiedCalled = true;
                }
            }
        }

        @Override
        public void onStreamCopyingThreadDone(StreamCopyingThread who) {

        }
    }

    class StreamCopyingThreadInputStream extends InputStream {

        ByteArrayInputStream inputStream;

        StreamCopyingThreadInputStream(String s) {
            inputStream = new ByteArrayInputStream(s.getBytes());
        }

        StreamCopyingThreadInputStream(byte[] data) {
            inputStream = new ByteArrayInputStream(data);
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

    class StreamCopyingThreadInputStreamInfinite extends InputStream {

        ByteArrayInputStream inputStream;
        Random random = new Random();

        StreamCopyingThreadInputStreamInfinite(String s) {
            inputStream = new ByteArrayInputStream(s.getBytes());
            bufferLength = s.length();
        }

        @Override
        public int read() throws IOException {
            inputStream.reset();
            return inputStream.read();
        }

        @Override
        public int read(byte[] buffer) throws IOException {
            inputStream.reset();

            try {
                Thread.sleep((random.nextInt(200) + 50));
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            return inputStream.read(buffer);
        }
    }

    class StreamCopyingThreadOutputStream extends OutputStream {

        private OutputStream output;
        volatile boolean isCloseCalled;

        public StreamCopyingThreadOutputStream(OutputStream output) {
            this.output = output;
        }

        @Override
        public void write(int oneByte) throws IOException {
            if (doThrowException) {
                throw new IOException("Test exception.");
            }
            output.write(oneByte);
        }

        @Override
        public void write(byte[] buffer) throws IOException {
            output.write(buffer);
        }

        @Override
        public void close() throws IOException {
            super.close();
            output.close();
            isCloseCalled = true;
        }
    }

    class StreamCopyingThreadOutputStreamInfinite extends OutputStream {
        public int counter = 0;

        @Override
        public void write(int oneByte) throws IOException {
            counter++;
            if (counter % bufferLength == 0) {
                mResult += mText;
            }
            bOutputStream.write(oneByte);
        }
    }
}
