package io.jxcore.node;

import android.content.Context;
import android.util.Log;

import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.MatcherAssert.assertThat;

public class StreamCopyingThreadTest {

    StreamCopyingThread mStreamCopyingThread;
    StreamCopyingThread.Listener mListener;
    Context mContext;
    InputStream mInputStream;
    OutputStream mOutputStream;
    String mThreadName = "My test thread name";
    String mText = "Lorem ipsum dolor sit amet, consectetur" +
        " adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua";
    ByteArrayOutputStream boutputStream;
    ArrayList<Integer> notifications;

    @Rule
    public ExpectedException thrown = ExpectedException.none();

    @Before
    public void setUp() throws Exception {
        notifications = new ArrayList<Integer>();

        mContext = jxcore.activity.getBaseContext();
        mListener = new ListenerMock();

        boutputStream = new ByteArrayOutputStream();
        mInputStream = new StreamCopyingThreadInputStream(mText);
        mOutputStream = new StreamCopyingThreadOutputStream(boutputStream);

        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
            mThreadName, new ConnectionData(new PeerProperties(), false));
    }

    @Test
    public void testSetBufferSize() throws Exception {
        thrown.expect(IllegalArgumentException.class);
        mStreamCopyingThread.setBufferSize(0);

        thrown.expect(IllegalArgumentException.class);
        mStreamCopyingThread.setBufferSize(1024 * 8 + 1);

        Field mBufferSizeField = mStreamCopyingThread.getClass().getDeclaredField("mBufferSize");
        mBufferSizeField.setAccessible(true);

        mStreamCopyingThread.setBufferSize(512 * 8);

        assertThat("The mBufferSize is properly set",
            mBufferSizeField.getInt(mStreamCopyingThread),
            is(512 * 8));
    }

    @Test
    public void testRun() throws Exception {
        Thread runner = new Thread(mStreamCopyingThread);
        runner.start();
        runner.join();

        assertThat("The content of the input stream is equal to the output stream",
            boutputStream.toString(),
            is(mText));
    }

    @Test
    public void testRunNotify() throws Exception {
        mStreamCopyingThread.setNotifyStreamCopyingProgress(true);
        Thread runner = new Thread(mStreamCopyingThread);
        runner.start();
        runner.join();

        assertThat("The content of the input stream is equal to the output stream",
            boutputStream.toString(),
            is(mText));

        assertThat("The stream copying progress notifications is properly updated",
            notifications.size() > 0,
            is(true));

        notifications.size();
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
            threadName, new ConnectionData(new PeerProperties(), false));

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
            threadName, new ConnectionData(new PeerProperties(), false));
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

    class StreamCopyingThreadOutputStream extends OutputStream {

        private OutputStream output;
        volatile boolean isCloseCalled;

        public StreamCopyingThreadOutputStream(OutputStream output) {
            this.output = output;
        }

        @Override
        public void write(int oneByte) throws IOException {
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
}
