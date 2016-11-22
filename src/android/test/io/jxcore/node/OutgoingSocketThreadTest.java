package io.jxcore.node;

import org.junit.Before;
import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.ServerSocket;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class OutgoingSocketThreadTest {

    ByteArrayOutputStream outgoingOutputStream;
    ListenerMock mListenerMockOutgoing;
    InputStreamMock mInputStreamMockOutgoing;
    OutputStreamMockOutgoing mOutputStreamMockOutgoing;
    OutgoingSocketThreadMock mOutgoingSocketThread;
    String textOutgoing = "Nullam in massa. Vivamus elit odio, in neque ut congue quis, venenatis" +
            " placerat, nulla ornare suscipit, erat urna, pellentesque dapibus vel, lorem. Sed " +
            "egestas non, dolor. Aliquam hendrerit sollicitudin sed.";

    ByteArrayOutputStream incomingOutputStream;
    ListenerMock mListenerMockIncoming;
    InputStreamMock mInputStreamMockIncoming;
    OutputStreamMockIncoming mOutputStreamMockIncoming;
    IncomingSocketThreadMock mIncomingSocketThread;
    String textIncoming = "Lorem ipsum dolor sit amet elit nibh, imperdiet dignissim, imperdiet " +
            "wisi. Morbi vel risus. Nunc molestie placerat, nulla mi, id nulla ornare risus. Sed " +
            "lacinia, urna eros lacus, elementum eu.";

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
        System.out.println("Running OutgoingSocketThread");
        mOutgoingSocketThread.setPort(57775);
        mIncomingSocketThread.setPort(57775);

        mOutgoingSocketThread.start();
        Thread.sleep(3000); //Wait for thread to start

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
        Thread.sleep(3000); //Wait for streamCopyingThreads

        assertThat("localStreamsCreatedSuccessfully should be true",
                mOutgoingSocketThread.localStreamsCreatedSuccessfully,
                is(true));

        assertThat("tempInputStream should be equal to mLocalInputStream",
                mOutgoingSocketThread.tempInputStream,
                is(equalTo(mOutgoingSocketThread.mLocalInputStream)));

        assertThat("tempOutputStream should be equal to mLocalOutputStream",
                mOutgoingSocketThread.tempOutputStream,
                is(equalTo(mOutgoingSocketThread.mLocalOutputStream)));

        assertThat("mLocalhostSocket port should be equal to 57775",
                mOutgoingSocketThread.mLocalhostSocket.getLocalPort(),
                is(equalTo(57775)));

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
