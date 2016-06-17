package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.os.CountDownTimer;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManagerSettings;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.hamcrest.CoreMatchers.anyOf;
import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;

public class ConnectionHelperTest {

    ConnectionHelper mConnectionHelper;
    ArrayList<String> outgoingThreadsIds;
    ArrayList<String> incomingThreadsIds;
    IncomingSocketThreadMock mIncomingSocketThreadMock;
    OutgoingSocketThreadMock mOutgoingSocketThreadMock;
    ListenerMock mListenerMock;
    InputStreamMock mInputStreamMock;
    OutputStreamMock mOutputStreamMock;
    ConnectionModel mConnectionModel;

    @Before
    public void setUp() throws Exception {

        mConnectionHelper = new ConnectionHelper();
        outgoingThreadsIds = new ArrayList<String>();
        incomingThreadsIds = new ArrayList<String>();
        mConnectionModel = new ConnectionModel();
        mInputStreamMock = new InputStreamMock();
        mOutputStreamMock = new OutputStreamMock();
        mListenerMock = new ListenerMock();
        mIncomingSocketThreadMock = new IncomingSocketThreadMock(null, mListenerMock,
                mInputStreamMock, mOutputStreamMock);

        mOutgoingSocketThreadMock = new OutgoingSocketThreadMock(null, mListenerMock,
                mInputStreamMock, mOutputStreamMock);
    }

    @After
    public void tearDown() throws Exception {

    }

    @Test
    public void testConstructor() throws Exception {
        Field fConnectionManager = mConnectionHelper.getClass().getField("mConnectionManager");
        Field fDiscoveryManager = mConnectionHelper.getClass().getField("mDiscoveryManager");
        Field fDiscoveryManagerSettings = mConnectionHelper.getClass()
                .getField("mDiscoveryManagerSettings");
        Field fContext = mConnectionHelper.getClass().getField("mContext");

        fConnectionManager.setAccessible(true);
        fDiscoveryManager.setAccessible(true);
        fDiscoveryManagerSettings.setAccessible(true);
        fContext.setAccessible(true);

        ConnectionManager mConnectionManager =
                (ConnectionManager) fConnectionManager.get(mConnectionHelper);
        DiscoveryManager mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);
        DiscoveryManagerSettings mDiscoveryManagerSettings =
                (DiscoveryManagerSettings) fDiscoveryManagerSettings.get(mConnectionHelper);
        Context mContext = (Context) fContext.get(mConnectionHelper);

        assertThat("ConnectionHelper is not null value", mConnectionHelper,is(notNullValue()));
        assertThat("ConnectionModel is not null value",
                mConnectionHelper.getConnectionModel(), is(notNullValue()));
        assertThat("ConnectionManager is not null value", mConnectionManager,is(notNullValue()));
        assertThat("DiscoveryManager is not null value", mDiscoveryManager, is(notNullValue()));
        assertThat("DiscoveryManagerSettings is not null value",
                mDiscoveryManagerSettings, is(notNullValue()));
        assertThat("Context is not null value",mContext, is(notNullValue()));
    }

    @Test
    public void testDispose() throws Exception {
        mConnectionHelper.dispose();

        Field fDiscoveryManager = mConnectionHelper.getClass().getField("mDiscoveryManager");
        Field fConnectionManager = mConnectionHelper.getClass().getField("mConnectionManager");
        Field fStartStopOperationHandler = mConnectionHelper.getClass()
                .getField("mStartStopOperationHandler");

        fDiscoveryManager.setAccessible(true);
        fConnectionManager.setAccessible(true);
        fStartStopOperationHandler.setAccessible(true);

        DiscoveryManager mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);
        ConnectionManager mConnectionManager =
                (ConnectionManager) fConnectionManager.get(mConnectionHelper);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);



        assertThat("Check if DiscoveryManager state is equal to NOT_STARTED",
                mDiscoveryManager.getState().toString(), is(equalTo("NOT_STARTED")));
        assertThat("Check if ConnectionManager state is equal to NOT_STARTED",
                mConnectionManager.getState().toString(), is(equalTo("NOT_STARTED")));

        Field fCurrentOperation = mStartStopOperationHandler.getClass().getField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        StartStopOperation mCurrentOperation = (StartStopOperation) fCurrentOperation.get(mConnectionHelper);

        assertThat("CurrentOperation in StartStopOperationHandler is null value",
                mCurrentOperation, is(nullValue()));
    }

    @Test
    public void testStart() throws Exception {
        assertThat("Start method returns true",
                mConnectionHelper.start(1111, false, null), is(equalTo(true)));

        Field fServerPortNumber = mConnectionHelper.getClass().getField("mServerPortNumber");
        Field fPowerUpBleDiscoveryTimer = mConnectionHelper.getClass()
                .getField("mPowerUpBleDiscoveryTimer");
        Field fStartStopOperationHandler = mConnectionHelper.getClass()
                .getField("fStartStopOperationHandler");

        fServerPortNumber.setAccessible(true);
        fPowerUpBleDiscoveryTimer.setAccessible(true);
        fStartStopOperationHandler.setAccessible(true);

        int mServerPortNumber = (Integer) fServerPortNumber.get(mConnectionHelper);
        CountDownTimer mPowerUpBleDiscoveryTimer =
                (CountDownTimer) fPowerUpBleDiscoveryTimer.get(mConnectionHelper);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        assertThat("Port number has a proper value", mServerPortNumber, is(equalTo(1111)));
        assertThat("CountDownTimer is null value", mPowerUpBleDiscoveryTimer, is(nullValue()));
        assertThat("StartStopOperation handler is not null value",
                mStartStopOperationHandler, is(notNullValue()));

        Field fCurrentOperation = mStartStopOperationHandler.getClass().getField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        StartStopOperation mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

        assertThat("CurrentOperation from mStartStopOperationHandler is not null value",
                mCurrentOperation, is(notNullValue()));

        mConnectionHelper.stop(false, null);
        assertThat(mConnectionHelper.start(-1111, false, null), is(equalTo(true)));

        assertThat(mServerPortNumber, is(equalTo(0)));
    }

    //Przyjrzec sie executeCurrentOperation
    @Test
    public void testStop() throws Exception {
        mConnectionHelper.stop(false, null);

        Field fStartStopOperationHandler = mConnectionHelper.getClass()
                .getField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        assertThat("mStartStopOperationHandler is not null value",
                mStartStopOperationHandler, is(notNullValue()));

        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        Field fOutgoingSocketThreads = mConnectionModel.getClass()
                .getField("mOutgoingSocketThreads");
        fOutgoingSocketThreads.setAccessible(true);
        CopyOnWriteArrayList<OutgoingSocketThread> mOutgoingSocketThreads =
                (CopyOnWriteArrayList<OutgoingSocketThread>)
                        fOutgoingSocketThreads.get("mConnectionModel");

        assertThat("OutgoingSocketThreads is empty after executing stop method",
                mOutgoingSocketThreads.isEmpty(), is(equalTo(true)));

        assertThat("Number of current connection after executing stop method is 0",
                mConnectionHelper.getConnectionModel()
                        .getNumberOfCurrentConnections(), is(equalTo(0)));
    }

    @Test
    public void testKillAllConnections() throws Exception {
        Field fConnectionModel = mConnectionHelper.getClass().getField("mConnectionModel");
        fConnectionModel.setAccessible(true);
        ConnectionModel mConnectionModel = (ConnectionModel) fConnectionModel.get("mConnectionHelper");

        mIncomingSocketThreadMock.setPeerProperties(new PeerProperties("incoming"));
        mIncomingSocketThreadMock.threadId = 1L;

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);

        assertThat("Number of killed incoming connection should be 1",
                mConnectionHelper.killAllConnections(),is(equalTo(1)));

        assertThat("Number of outgoing connection should be 0 after killAllConnections()",
                mConnectionHelper.getConnectionModel().getNumberOfCurrentOutgoingConnections(),
                is(equalTo(0)));
        assertThat("Number of incoming connections should be 0 after killALlConnections()",
                mConnectionHelper.getConnectionModel().getNumberOfCurrentIncomingConnections(),
                is(equalTo(0)));
    }

    @Test
    public void testIsRunning() throws Exception {
        Field fConnectionManager = mConnectionHelper.getClass().getField("mConnectionManager");
        Field fDiscoveryManager = mConnectionHelper.getClass().getField("mDiscoveryManager");

        fConnectionManager.setAccessible(true);
        fDiscoveryManager.setAccessible(true);

        ConnectionManager mConnectionManager =
                (ConnectionManager) fConnectionManager.get(mConnectionHelper);
        DiscoveryManager mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);

        assertThat("ConnectionManager state is different than NOT_STARTED",
                mConnectionManager.getState(),
                is(not(equalTo(ConnectionManager.ConnectionManagerState.NOT_STARTED))));
        assertThat("ConnectionManager state can be either WAITING_FOR_SERVICES_TO_BE_ENABLED or RUNNING",
                mConnectionManager.getState(),
                is(anyOf(equalTo(ConnectionManager.ConnectionManagerState.WAITING_FOR_SERVICES_TO_BE_ENABLED),
                        equalTo(ConnectionManager.ConnectionManagerState.RUNNING))));

        assertThat("isRunning return true", mDiscoveryManager.isRunning(), equalTo(true));
        assertThat("isRunning not returns false", mDiscoveryManager.isRunning(),not(equalTo(false)));
    }

    @Test
    public void testGetConnectivityMonitorGetDiscoveryManagerGetConnectionModelGetBluetoothName() throws Exception {
        Field fConnectivityMonitor = mConnectionHelper.getClass().getField("mConnectivityMonitor");
        Field fDiscoveryManager = mConnectionHelper.getClass().getField("mDiscoveryManager");
        Field fConnectionModel = mConnectionHelper.getClass().getField("mConnectionModel");

        fConnectivityMonitor.setAccessible(true);
        fDiscoveryManager.setAccessible(true);
        fConnectionModel.setAccessible(true);

        ConnectivityMonitor mConnectivityMonitor =
                (ConnectivityMonitor) fConnectivityMonitor.get("mConnectionHelper");
        DiscoveryManager mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get("mConnectionHelper");
        ConnectionModel mConnectionModel =
                (ConnectionModel) fConnectionModel.get("mConnectionHelper");

        assertThat("mConnectivityMonitor is equal to getConnectivityMonitor",
                mConnectivityMonitor,is(equalTo(mConnectionHelper.getConnectivityMonitor())));
        assertThat("mDiscoveryManager is equal to getDiscoveryManager",
                mDiscoveryManager,is(equalTo(mConnectionHelper.getDiscoveryManager())));
        assertThat("mConnectionModel is equal to getConnectionModel",
                mConnectionModel,is(equalTo(mConnectionHelper.getConnectionModel())));

        BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        if(bluetoothAdapter != null){
            assertThat("bluetoothAdapter.getName() is equal to getBluetoothName",
                    bluetoothAdapter.getName(),is(equalTo(mConnectionHelper.getBluetoothName())));
            assertThat("getBluetoothName is not null",mConnectionHelper.getBluetoothName(),is(notNullValue()));
        } else {
            assertThat("If bluetoothAdapter is null then getBluetoothName returns null",
                    mConnectionHelper.getBluetoothName(),is(nullValue()));
        }
    }

    @Test
    public void testDisconnectOutgoingConnection() throws Exception {
        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        mIncomingSocketThreadMock.setPeerProperties(new PeerProperties("macAddress"));

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);

        boolean result = mConnectionHelper.disconnectOutgoingConnection("randomString");
        assertThat("No connection with peerId = randomString, should return false",
                result,is(false));

        result = mConnectionHelper.disconnectOutgoingConnection(mIncomingSocketThreadMock
                .getPeerProperties().toString());

        assertThat("Disconnect connection with proper peerId, should return true ",
                result,is(true));

        result = mConnectionHelper.disconnectOutgoingConnection(mIncomingSocketThreadMock
                .getPeerProperties().toString());

        assertThat("Connection with this peerId should be already removed, so now method should return false ",
                result,is(false));

    }

    @Test
    public void testHasMaximumNumberOfConnections() throws Exception {
        Field fMAXIMUM_NUMBER_OF_CONNECTIONS = mConnectionHelper.getClass()
                .getField("MAXIMUM_NUMBER_OF_CONNECTIONS");
        Field fConnectionModel = mConnectionHelper.getClass().getField("mConnectinoModel");

        fMAXIMUM_NUMBER_OF_CONNECTIONS.setAccessible(true);
        fConnectionModel.setAccessible(true);

        int MAXIMUM_NUMBER_OF_CONNECTIONS =
                (Integer) fMAXIMUM_NUMBER_OF_CONNECTIONS.get("mConnectionHelper");
        ConnectionModel mConnectionModel = (ConnectionModel) fConnectionModel.get("mConnectionHelper");

        OutgoingSocketThreadMock mOutgoingSocketThreadMock =
                new OutgoingSocketThreadMock(null, mListenerMock, mInputStreamMock, mOutputStreamMock);
        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties("00:11:22:33:44:55"));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);
        assertThat("mOutgoingSocketThreads size should be 1, number of max connections = 30, then return false",
                mConnectionHelper.hasMaximumNumberOfConnections(),is(false));

        fMAXIMUM_NUMBER_OF_CONNECTIONS.set("mConnectionHelper",2);
        MAXIMUM_NUMBER_OF_CONNECTIONS =
                (Integer) fMAXIMUM_NUMBER_OF_CONNECTIONS.get("mConnectionHelper");

        OutgoingSocketThreadMock mOutgoingSocketThreadMock2 =
                new OutgoingSocketThreadMock(null, mListenerMock,mInputStreamMock,mOutputStreamMock);
        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties("11:11:22:33:44:55"));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock2);
        assertThat("mOutgoingSocketThreads size should be 2, number of max connections also 2, return true",
                mConnectionHelper.hasMaximumNumberOfConnections(),is(true));

    }

    @Test
    public void testConnect() throws Exception {
        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        String bluetoothMacAddressOutgoing = "00:11:22:33:44:55";
        JXcoreThaliCallbackMock callbackMock = new JXcoreThaliCallbackMock();

        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties(bluetoothMacAddressOutgoing));

        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);

        String result = mConnectionHelper.connect(bluetoothMacAddressOutgoing,null);
        assertThat(result, is(equalTo("We already have an outgoing connection to peer with ID "
                + bluetoothMacAddressOutgoing)));

        mConnectionHelper.killAllConnections();

        Field fMAXIMUM_NUMBER_OF_CONNECTIONS = mConnectionHelper.getClass().getField("MAXIMUM_NUMBER_OF_CONNECTIONS");
        fMAXIMUM_NUMBER_OF_CONNECTIONS.setAccessible(true);
        fMAXIMUM_NUMBER_OF_CONNECTIONS.set(mConnectionHelper,1);

        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing,null);
        assertThat("Maximum number of peer connections reached ",
                result, is(equalTo("Maximum number of peer connections ("
                + mConnectionModel.getNumberOfCurrentOutgoingConnections()
                + ") reached, please try again after disconnecting a peer")));

        fMAXIMUM_NUMBER_OF_CONNECTIONS.set(mConnectionHelper,30);
        mConnectionHelper.killAllConnections();

        result = mConnectionHelper.connect("abcd",null);
        assertThat("Invalid bluetooth MAC address",
                result,is(equalTo("Invalid Bluetooth MAC address: abcd")));

        mConnectionHelper.killAllConnections();

        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing,null);
        assertThat("Failed to add null callback",
                result, is(equalTo("Failed to add the callback for the connection")));

        mConnectionHelper.killAllConnections();
        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing, callbackMock);
        assertThat(result,is(nullValue()));

    }

    @Test
    public void testToggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber() throws Exception {
        Field fContext = mConnectionHelper.getClass().getField("mContext");
        fContext.setAccessible(true);
        Context mContext = (Context) fContext.get(mConnectionHelper);
    }

    @Test
    public void testOnConnectionManagerStateChanged() throws Exception {

    }

    @Test
    public void testOnConnected() throws Exception {

    }

    @Test
    public void testOnConnectionTimeout() throws Exception {

    }

    @Test
    public void testOnConnectionFailed() throws Exception {

    }

    @Test
    public void testOnPermissionCheckRequired() throws Exception {

    }

    @Test
    public void testOnDiscoveryManagerStateChanged() throws Exception {

    }

    @Test
    public void testOnPeerDiscovered() throws Exception {

    }

    @Test
    public void testOnPeerUpdated() throws Exception {

    }

    @Test
    public void testOnPeerLost() throws Exception {

    }

    @Test
    public void testOnProvideBluetoothMacAddressRequest() throws Exception {

    }

    @Test
    public void testOnPeerReadyToProvideBluetoothMacAddress() throws Exception {

    }

    @Test
    public void testOnBluetoothMacAddressResolved() throws Exception {

    }
}
