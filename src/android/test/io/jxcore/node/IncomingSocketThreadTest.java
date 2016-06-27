package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.CountDownTimer;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.ConnectionManagerSettings;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManagerSettings;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.hamcrest.CoreMatchers.anyOf;
import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;
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

    @After
    public void tearDown() throws Exception {

    }

    @Test
    public void testConstructor() throws Exception {
        assertThat("mIncomingSocketThread should not be null", mIncomingSocketThread, is(notNullValue()));
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
    }

}
