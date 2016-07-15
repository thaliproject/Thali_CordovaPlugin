package io.jxcore.node;

import org.junit.Before;
import org.junit.Test;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class ConnectionModelTest {

    IncomingSocketThreadMock mIncomingSocketThreadMock;
    OutgoingSocketThreadMock mOutgoingSocketThreadMock;
    ListenerMock mListenerMock;
    InputStreamMock mInputStreamMock;
    OutputStreamMock mOutputStreamMock;
    ConnectionModel mConnectionModel;

    @Before
    public void setUp() throws Exception {
        mConnectionModel = new ConnectionModel();
        mInputStreamMock = new InputStreamMock();
        mOutputStreamMock = new OutputStreamMock();
        mListenerMock = new ListenerMock();
        mIncomingSocketThreadMock = new IncomingSocketThreadMock(null, mListenerMock,
                mInputStreamMock, mOutputStreamMock);

        mOutgoingSocketThreadMock = new OutgoingSocketThreadMock(null, mListenerMock,
                mInputStreamMock, mOutputStreamMock);
    }

    @Test
    public void constructorTest() {
        ConnectionModel cm = new ConnectionModel();
        assertThat("ConnectionHelper is properly instantiated", cm, is(notNullValue()));
    }

    @Test
    public void testHasIncomingConnection() throws Exception {
        mIncomingSocketThreadMock.setPeerProperties(new PeerProperties("btmacaddress"));

        assertThat("Returns false if there are no incoming connections",
                mConnectionModel.hasIncomingConnection("id"), is(false));

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);
        assertThat("Returns true if there is incoming connection",
                mConnectionModel.hasIncomingConnection("btmacaddress"), is(true));
    }

    @Test
    public void testHasOutgoingConnection() throws Exception {
        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties("btmacaddress"));

        assertThat("Returns false if there are no outgoing connections",
                mConnectionModel.hasOutgoingConnection("id"), is(false));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);
        assertThat("Returns true if there is outgoing connection",
                mConnectionModel.hasOutgoingConnection("btmacaddress"), is(true));
    }

    @Test
    public void testHasConnection() throws Exception {
        assertThat("Returns false if there are no connections",
                mConnectionModel.hasConnection("id"), is(false));
        mIncomingSocketThreadMock.setPeerProperties(new PeerProperties("incoming"));
        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties("outgoing"));

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);
        assertThat("Returns false if the requested connection is not found",
                mConnectionModel.hasConnection("outgoing"), is(false));

        assertThat("Returns true if the requested connection is found",
                mConnectionModel.hasConnection("incoming"), is(true));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);

        assertThat("Returns true if the requested connection is found",
                mConnectionModel.hasConnection("outgoing"), is(true));
    }

    @Test
    public void testGetNumberOfCurrentConnections() throws Exception {
        mIncomingSocketThreadMock.setPeerProperties(new PeerProperties("incoming"));
        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties("outgoing"));

        assertThat("Returns 0 if no connections established",
                mConnectionModel.getNumberOfCurrentConnections(), is(equalTo(0)));

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);

        assertThat("Returns proper number of connections",
                mConnectionModel.getNumberOfCurrentConnections(), is(equalTo(1)));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);

        assertThat("Returns proper number of connections",
                mConnectionModel.getNumberOfCurrentConnections(), is(equalTo(2)));

        assertThat("IncommingConnectionThread is closed",
                mConnectionModel.closeAndRemoveAllIncomingConnections(), is(equalTo(1)));

        assertThat("Thread is properly closed",
                mIncomingSocketThreadMock.closeCalled, is(true));

        assertThat("Returns proper number of connections",
                mConnectionModel.getNumberOfCurrentConnections(), is(equalTo(1)));

        mConnectionModel.closeAndRemoveAllOutgoingConnections();

        assertThat("Thread is properly closed",
                mOutgoingSocketThreadMock.closeCalled, is(true));

        assertThat("Returns proper number of connections",
                mConnectionModel.getNumberOfCurrentConnections(), is(equalTo(0)));
    }

    @Test
    public void testGetNumberOfCurrentIncomingConnections() throws Exception {
        mIncomingSocketThreadMock.setPeerProperties(new PeerProperties("incoming"));
        mIncomingSocketThreadMock.threadId = 1L;

        InputStreamMock inputStreamMock2 = new InputStreamMock();
        OutputStreamMock outputStreamMock2 = new OutputStreamMock();
        ListenerMock listenerMock2 = new ListenerMock();

        IncomingSocketThreadMock incomingSocketThreadMock2 = new IncomingSocketThreadMock(null,
                listenerMock2, inputStreamMock2, outputStreamMock2);

        incomingSocketThreadMock2.setPeerProperties(new PeerProperties("incoming2"));
        incomingSocketThreadMock2.threadId = 2L;

        assertThat("Returns 0 if no connections established",
                mConnectionModel.getNumberOfCurrentIncomingConnections(), is(equalTo(0)));

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);

        assertThat("Returns proper number of incoming connections",
                mConnectionModel.getNumberOfCurrentIncomingConnections(), is(equalTo(1)));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);

        assertThat("Returns proper number of incoming connections",
                mConnectionModel.getNumberOfCurrentIncomingConnections(), is(equalTo(1)));

        mConnectionModel.addConnectionThread(incomingSocketThreadMock2);

        assertThat("Returns proper number of incoming connections",
                mConnectionModel.getNumberOfCurrentIncomingConnections(), is(equalTo(2)));

        assertThat("IncomingConnectionThread is closed",
                mConnectionModel.closeAndRemoveIncomingConnectionThread(1L), is(true));

        assertThat("Thread is properly closed",
                mIncomingSocketThreadMock.closeCalled, is(true));

        assertThat("Cannot close already closed IncomingConnectionThread",
                mConnectionModel.closeAndRemoveIncomingConnectionThread(1L), is(false));

        assertThat("IncomingConnectionThread is closed",
                mConnectionModel.closeAndRemoveIncomingConnectionThread(2L), is(true));

        assertThat("Thread is properly closed",
                incomingSocketThreadMock2.closeCalled, is(true));

        assertThat("All other connections are not removed",
                mConnectionModel.getNumberOfCurrentConnections(), is(equalTo(1)));
    }

    @Test
    public void testGetNumberOfCurrentOutgoingConnections() throws Exception {
        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties("outgoing"));
        mOutgoingSocketThreadMock.threadId = 1L;

        InputStreamMock inputStreamMock2 = new InputStreamMock();
        OutputStreamMock outputStreamMock2 = new OutputStreamMock();
        ListenerMock listenerMock2 = new ListenerMock();

        OutgoingSocketThreadMock outgoingSocketThreadMock2 = new OutgoingSocketThreadMock(null,
                listenerMock2,inputStreamMock2, outputStreamMock2);

        outgoingSocketThreadMock2.setPeerProperties(new PeerProperties("outgoing2"));
        outgoingSocketThreadMock2.threadId = 2L;

        assertThat("Returns 0 if no connections established",
                mConnectionModel.getNumberOfCurrentOutgoingConnections(), is(equalTo(0)));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);
        mConnectionModel.addOutgoingConnectionCallback("outgoing", new JXcoreThaliCallbackMock());

        assertThat("The callback is properly added",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing"),
                is(notNullValue()));

        assertThat("Returns proper number of outgoing connections",
                mConnectionModel.getNumberOfCurrentOutgoingConnections(), is(equalTo(1)));

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);

        assertThat("Returns proper number of outgoing connections",
                mConnectionModel.getNumberOfCurrentOutgoingConnections(), is(equalTo(1)));

        mConnectionModel.addConnectionThread(outgoingSocketThreadMock2);
        mConnectionModel.addOutgoingConnectionCallback("outgoing2", new JXcoreThaliCallbackMock());

        assertThat("Returns proper number of outgoing connections",
                mConnectionModel.getNumberOfCurrentOutgoingConnections(), is(equalTo(2)));

        assertThat("OutgoingConnectionThread is closed",
                mConnectionModel.closeAndRemoveOutgoingConnectionThread("outgoing"), is(true));

        assertThat("Thread is properly closed",
                mOutgoingSocketThreadMock.closeCalled, is(true));

        assertThat("Proper callback is removed",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing"),
                is(nullValue()));

        assertThat("The other callback remains",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing2"),
                is(notNullValue()));

        assertThat("Cannot close already closed OutgoingConnectionThread",
                mConnectionModel.closeAndRemoveOutgoingConnectionThread("outgoing"), is(false));

        assertThat("OutgoingConnectionThread is closed",
                mConnectionModel.closeAndRemoveOutgoingConnectionThread("outgoing2"), is(true));

        assertThat("Thread is properly closed",
                outgoingSocketThreadMock2.closeCalled, is(true));

        assertThat("Callback is removed",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing2"),
                is(nullValue()));

        assertThat("All other connections are not removed",
                mConnectionModel.getNumberOfCurrentConnections(), is(equalTo(1)));
    }

    @Test
    public void testGetOutgoingConnectionCallbackByBluetoothMacAddress() throws Exception {
        JXcoreThaliCallback jxCallback1 = new JXcoreThaliCallbackMock();
        JXcoreThaliCallback jxCallback2 = new JXcoreThaliCallbackMock();

        mConnectionModel.addOutgoingConnectionCallback("outgoing1", jxCallback1);
        mConnectionModel.addOutgoingConnectionCallback("outgoing2", jxCallback2);

        assertThat("The callback1 is properly added",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing1"),
                is(jxCallback1));

        assertThat("The callback2 is properly added",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing2"),
                is(jxCallback2));

        mConnectionModel.removeOutgoingConnectionCallback("outgoing1");

        assertThat("The callback1 is properly removed",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing1"),
                is(nullValue()));

        mConnectionModel.removeOutgoingConnectionCallback("outgoing2");

        assertThat("The callback2 is properly removed",
                mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress("outgoing2"),
                is(nullValue()));
    }
}