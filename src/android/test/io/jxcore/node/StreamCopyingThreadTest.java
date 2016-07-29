package io.jxcore.node;

import android.content.Context;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;

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
        mOutputStream = new StreamCopyingThreadOutputStream();

        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
                mThreadName);
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

    class ListenerMock implements StreamCopyingThread.Listener {

        @Override
        public void onStreamCopyError(StreamCopyingThread who, String errorMessage) {

        }

        @Override
        public void onStreamCopySucceeded(StreamCopyingThread who, int numberOfBytes) {
            notifications.add(numberOfBytes);
        }

        @Override
        public void onStreamCopyingThreadDone(StreamCopyingThread who){

        }
    }

    class StreamCopyingThreadInputStream extends InputStream {

        ByteArrayInputStream inputStream;

        StreamCopyingThreadInputStream(String s) {
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

    class StreamCopyingThreadOutputStream extends OutputStream {

        @Override
        public void write(int oneByte) throws IOException {
            boutputStream.write(oneByte);
        }
    }
}
