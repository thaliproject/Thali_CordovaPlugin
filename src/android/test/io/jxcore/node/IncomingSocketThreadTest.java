package io.jxcore.node;

import org.junit.Before;
import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.Socket;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class IncomingSocketThreadTest {

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

    @Before
    public void setUp() throws Exception {
        outgoingOutputStream = new ByteArrayOutputStream();
        incomingOutputStream = new ByteArrayOutputStream();

        mInputStreamMockIncoming = new InputStreamMock(textIncoming);
        mOutputStreamMockIncoming = new OutputStreamMockIncoming();
        mListenerMockIncoming = new ListenerMock();
        mIncomingSocketThread =
                new IncomingSocketThreadMock(null, mListenerMockIncoming, mInputStreamMockIncoming,
                        mOutputStreamMockIncoming);

        mInputStreamMockOutgoing = new InputStreamMock(textOutgoing);
        mOutputStreamMockOutgoing = new OutputStreamMockOutgoing();
        mListenerMockOutgoing = new ListenerMock();
        mOutgoingSocketThread =
                new OutgoingSocketThreadMock(null, mListenerMockOutgoing, mInputStreamMockOutgoing,
                        mOutputStreamMockOutgoing);
    }

    @Test
    public void testConstructor() throws Exception {
        assertThat("mIncomingSocketThread should not be null", mIncomingSocketThread,
                is(notNullValue()));
    }

    @Test
    public void testGetTcpPortNumber() throws Exception {
        Field fTcpPortNumber = mIncomingSocketThread.getClass().getSuperclass()
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
                .getSuperclass().getDeclaredField("mLocalhostSocket");
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

    @Test
    public void testRun() throws Exception {
        Thread checkOutgoingSocketThreadStart = new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (mOutgoingSocketThread.mServerSocket == null && counter < 10) {
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e1) {
                        e1.printStackTrace();
                    }
                }
            }
        });

        Thread checkIncomingSocketThreadStart = new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (!mIncomingSocketThread.localStreamsCreatedSuccessfully && counter < 10) {
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
            }
        });

        mOutgoingSocketThread.setPort(testPortNumber);
        mIncomingSocketThread.setPort(testPortNumber);

        mOutgoingSocketThread.start(); //Simulate end point to connect to
        checkOutgoingSocketThreadStart.start();
        checkOutgoingSocketThreadStart.join();

        mIncomingSocketThread.start(); //Connect to end point
        checkIncomingSocketThreadStart.start();
        checkIncomingSocketThreadStart.join();

        assertThat("localStreamsCreatedSuccessfully should be true",
                mIncomingSocketThread.localStreamsCreatedSuccessfully,
                is(true));

        assertThat("tempInputStream should be equal to mLocalInputStream",
                mIncomingSocketThread.tempInputStream,
                is(equalTo(mIncomingSocketThread.mLocalInputStream)));

        assertThat("tempOutputStream should be equal to mLocalOutputStream",
                mIncomingSocketThread.tempOutputStream,
                is(equalTo(mIncomingSocketThread.mLocalOutputStream)));

        assertThat("mLocalhostSocket port should be equal to 47775",
                mIncomingSocketThread.mLocalhostSocket.getPort(),
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
}
