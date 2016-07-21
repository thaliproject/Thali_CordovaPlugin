package io.jxcore.node;

import org.junit.Before;
import org.junit.Test;

import java.lang.reflect.Field;
import java.net.ServerSocket;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class OutgoingSocketThreadTest {
    ListenerMock mListenerMock;
    InputStreamMock mInputStreamMock;
    OutputStreamMock mOutputStreamMock;
    OutgoingSocketThread mOutgoingSocketThread;

    @Before
    public void setUp() throws Exception {
        mInputStreamMock = new InputStreamMock();
        mOutputStreamMock = new OutputStreamMock();
        mListenerMock = new ListenerMock();
        mOutgoingSocketThread =
                new OutgoingSocketThread(null, mListenerMock, mInputStreamMock, mOutputStreamMock);
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

    @Test
    public void testRun() throws Exception {
        System.out.println("Running OutgoingSocketThread");
        mOutgoingSocketThread.start();

        Thread.sleep(1000); //Wait for thread to start

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
        //TODO Simulate incoming connection
    }
}
