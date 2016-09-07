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
import java.util.Random;

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
    int counter = 0;
    int bufferLength = 0;
    ByteArrayOutputStream bOutputStream;
    ArrayList<Integer> notifications;
    boolean doThrowException = false;


    @Rule
    public ExpectedException thrown = ExpectedException.none();

    @Before
    public void setUp() throws Exception {
        mResult = "Lorem ipsum dolor sit.";
        notifications = new ArrayList<Integer>();

        mContext = jxcore.activity.getBaseContext();
        mListener = new ListenerMock();

        bOutputStream = new ByteArrayOutputStream();
        mInputStream = new StreamCopyingThreadInputStream(mResult);
        mOutputStream = new StreamCopyingThreadOutputStream();

        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
                mThreadName);
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

    @Test
    public void testRun() throws Exception {
        mResult = "";
        bOutputStream = new ByteArrayOutputStream();
        mInputStream = new StreamCopyingThreadInputStreamInfinite(mText);
        mOutputStream = new StreamCopyingThreadOutputStreamInfinite();
        mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
                mThreadName);

        mStreamCopyingThread.start();

        Thread.sleep(2000);

        mStreamCopyingThread.close();

        assertThat("The content of the input stream is equal to the output stream",
                bOutputStream.toString(),
                is(mResult));
    }

    @Test
    public void testRunWithException() throws Exception {
        doThrowException = true;
        StreamCopyingThread streamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
                mThreadName);
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
                notifications.size() > 0,
                is(true));

        notifications.size();
    }

    class ListenerMock implements StreamCopyingThread.Listener {

        @Override
        public void onStreamCopyError(StreamCopyingThread who, String errorMessage) {
            lastExceptionMessage = errorMessage;
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

        @Override
        public void write(int oneByte) throws IOException {
            if (doThrowException) {
                throw new IOException("Test exception.");
            }
            bOutputStream.write(oneByte);
        }
    }

    class StreamCopyingThreadOutputStreamInfinite extends OutputStream {

        @Override
        public void write(int oneByte) throws IOException {
            counter++;
            if(counter % bufferLength == 0){
                mResult += mText;
            }
            bOutputStream.write(oneByte);
        }
    }
}
