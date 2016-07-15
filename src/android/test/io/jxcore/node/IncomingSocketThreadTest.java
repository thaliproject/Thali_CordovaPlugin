package io.jxcore.node;

import org.junit.Before;
import org.junit.Test;

import java.lang.reflect.Field;
import java.net.Socket;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class IncomingSocketThreadTest {

    ListenerMock mListenerMock;
    InputStreamMock mInputStreamMock;
    OutputStreamMock mOutputStreamMock;
    IncomingSocketThread mIncomingSocketThread;

    @Before
    public void setUp() throws Exception {
        mInputStreamMock = new InputStreamMock();
        mOutputStreamMock = new OutputStreamMock();
        mListenerMock = new ListenerMock();
        mIncomingSocketThread =
                new IncomingSocketThread(null, mListenerMock, mInputStreamMock, mOutputStreamMock);
    }

    @Test
    public void testConstructor() throws Exception {
        assertThat("mIncomingSocketThread should not be null", mIncomingSocketThread,
                is(notNullValue()));
    }

    @Test
    public void testGetTcpPortNumber() throws Exception {
        Field fTcpPortNumber = mIncomingSocketThread.getClass().getDeclaredField("mTcpPortNumber");
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
                .getDeclaredField("mLocalhostSocket");
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
}
