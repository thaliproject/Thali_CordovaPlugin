package io.jxcore.node;

import android.content.Context;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
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
                
                while (!mIsClosed && counter < ThaliTestRunner.counterLimit) {
                    try {
                        Thread.sleep(ThaliTestRunner.timeoutLimit);
                        counter++;
                        mIsClosed = fIsClosed.getBoolean(mStreamCopyingThread);
                    } catch (InterruptedException|IllegalAccessException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                
                if (counter < ThaliTestRunner.counterLimit) {
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
mOutputStream = new StreamCopyingThreadOutputStream();

mStreamCopyingThread = new StreamCopyingThread(mListener, mInputStream, mOutputStream,
mThreadName);
mExecutor = Executors.newSingleThreadExecutor();
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

mStreamCopyingThread.setNotifyStreamCopyingProgress(true);

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
}

class ListenerMock implements StreamCopyingThread.Listener {
    
    @Override
    public void onStreamCopyError(StreamCopyingThread who, String errorMessage) {
        lastExceptionMessage = errorMessage;
    }
    
    @Override
    public void onStreamCopySucceeded(StreamCopyingThread who, int numberOfBytes) {
        notifications.add(numberOfBytes);
        
        if (notifications.size() > 10) {
            mStreamCopyingThread.close();
        }
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
    public int counter = 0;
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
