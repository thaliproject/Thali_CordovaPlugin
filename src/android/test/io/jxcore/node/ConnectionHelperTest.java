package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.os.CountDownTimer;

import org.junit.After;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
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

public class ConnectionHelperTest {

    public static ConnectionHelper mConnectionHelper;
    public static JXcoreThaliCallbackMock mJXcoreThaliCallbackMock;
    ArrayList<String> outgoingThreadsIds;
    ArrayList<String> incomingThreadsIds;
    ListenerMock mListenerMock;
    InputStreamMock mInputStreamMock;
    OutputStreamMock mOutputStreamMock;

    @Rule
    public ExpectedException thrown = ExpectedException.none();

    @BeforeClass
    public static void setUpBeforeClass() throws Exception {
        mConnectionHelper = new ConnectionHelper();
        mJXcoreThaliCallbackMock = new JXcoreThaliCallbackMock();
    }

    @Before
    public void setUp() throws Exception {
        outgoingThreadsIds = new ArrayList<String>();
        incomingThreadsIds = new ArrayList<String>();
        mInputStreamMock = new InputStreamMock();
        mOutputStreamMock = new OutputStreamMock();
        mListenerMock = new ListenerMock();
    }

    @After
    public void tearDown() throws Exception {
        mConnectionHelper.killConnections(true);
        mConnectionHelper.stop(false, mJXcoreThaliCallbackMock);
        mConnectionHelper.dispose();
        mConnectionHelper.getDiscoveryManager().stop();
        mConnectionHelper.getDiscoveryManager().stopAdvertising();
        mConnectionHelper.getDiscoveryManager().stopDiscovery();
        mConnectionHelper.getDiscoveryManager().dispose();
    }

    @Test
    public void testConstructor() throws Exception {
        Field fConnectionManager = mConnectionHelper.getClass()
                .getDeclaredField("mConnectionManager");
        Field fDiscoveryManager = mConnectionHelper.getClass()
                .getDeclaredField("mDiscoveryManager");
        Field fDiscoveryManagerSettings = mConnectionHelper.getClass()
                .getDeclaredField("mDiscoveryManagerSettings");
        Field fContext = mConnectionHelper.getClass().getDeclaredField("mContext");

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

        assertThat("ConnectionHelper is not null value", mConnectionHelper, is(notNullValue()));
        assertThat("ConnectionModel is not null value",
                mConnectionHelper.getConnectionModel(), is(notNullValue()));
        assertThat("ConnectionManager is not null value", mConnectionManager, is(notNullValue()));
        assertThat("DiscoveryManager is not null value", mDiscoveryManager, is(notNullValue()));
        assertThat("DiscoveryManagerSettings is not null value",
                mDiscoveryManagerSettings, is(notNullValue()));
        assertThat("Context is not null value", mContext, is(notNullValue()));
    }

    @Test
    public void testDispose() throws Exception {
        mConnectionHelper.dispose();

        Field fDiscoveryManager = mConnectionHelper.getClass()
                .getDeclaredField("mDiscoveryManager");
        Field fConnectionManager = mConnectionHelper.getClass()
                .getDeclaredField("mConnectionManager");
        Field fStartStopOperationHandler = mConnectionHelper.getClass()
                .getDeclaredField("mStartStopOperationHandler");

        fDiscoveryManager.setAccessible(true);
        fConnectionManager.setAccessible(true);
        fStartStopOperationHandler.setAccessible(true);

        DiscoveryManager mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);
        ConnectionManager mConnectionManager =
                (ConnectionManager) fConnectionManager.get(mConnectionHelper);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        assertThat("DiscoveryManager state is equal to NOT_STARTED",
                mDiscoveryManager.getState().toString(), is(equalTo("NOT_STARTED")));
        assertThat("ConnectionManager state is equal to NOT_STARTED",
                mConnectionManager.getState().toString(), is(equalTo("NOT_STARTED")));

        Field fCurrentOperation = mStartStopOperationHandler.getClass()
                .getDeclaredField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        StartStopOperation mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

        assertThat("CurrentOperation in StartStopOperationHandler is null value",
                mCurrentOperation, is(nullValue()));

        mDiscoveryManager.dispose();
        mConnectionManager.dispose();
    }

    @Test
    public void testStart() throws Exception {
        assertThat("Start method returns true",
                mConnectionHelper.start(1111, false, mJXcoreThaliCallbackMock), is(equalTo(true)));

        Field fServerPortNumber = mConnectionHelper.getClass()
                .getDeclaredField("mServerPortNumber");
        Field fPowerUpBleDiscoveryTimer = mConnectionHelper.getClass()
                .getDeclaredField("mPowerUpBleDiscoveryTimer");
        Field fStartStopOperationHandler = mConnectionHelper.getClass()
                .getDeclaredField("mStartStopOperationHandler");

        fServerPortNumber.setAccessible(true);
        fPowerUpBleDiscoveryTimer.setAccessible(true);
        fStartStopOperationHandler.setAccessible(true);

        int mServerPortNumber = fServerPortNumber.getInt(mConnectionHelper);
        CountDownTimer mPowerUpBleDiscoveryTimer =
                (CountDownTimer) fPowerUpBleDiscoveryTimer.get(mConnectionHelper);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        assertThat("Port number has a proper value", mServerPortNumber, is(equalTo(1111)));
        assertThat("CountDownTimer is null value", mPowerUpBleDiscoveryTimer, is(nullValue()));
        assertThat("StartStopOperation handler is not null value",
                mStartStopOperationHandler, is(notNullValue()));

        if (!mConnectionHelper.getDiscoveryManager().isBleMultipleAdvertisementSupported()) {
            assertThat("DiscoveryManager1 isRunning should return false",
                    mConnectionHelper.getDiscoveryManager().isRunning(), is(false));
        } else {
            assertThat("DiscoveryManager1 isRunning should return true",
                    mConnectionHelper.getDiscoveryManager().isRunning(), is(true));
        }

        mConnectionHelper.stop(false, mJXcoreThaliCallbackMock);
        mConnectionHelper.dispose();

        assertThat("Start method returns true",
                mConnectionHelper.start(-1111, false, mJXcoreThaliCallbackMock), is(equalTo(true)));

        mServerPortNumber = fServerPortNumber.getInt(mConnectionHelper);
        mPowerUpBleDiscoveryTimer =
                (CountDownTimer) fPowerUpBleDiscoveryTimer.get(mConnectionHelper);
        mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        assertThat("Port number has a proper value, not changed because -1111 < 0",
                mServerPortNumber, is(equalTo(1111)));
        assertThat("CountDownTimer is null value", mPowerUpBleDiscoveryTimer, is(nullValue()));
        assertThat("StartStopOperation handler is not null value",
                mStartStopOperationHandler, is(notNullValue()));

        if (!mConnectionHelper.getDiscoveryManager().isBleMultipleAdvertisementSupported()) {
            assertThat("DiscoveryManager isRunning should return false",
                    mConnectionHelper.getDiscoveryManager().isRunning(), is(false));
        } else {
            assertThat("DiscoveryManager isRunning should return true",
                    mConnectionHelper.getDiscoveryManager().isRunning(), is(true));
        }
    }

    @SuppressWarnings("unchecked")
    @Test
    public void testStop() throws Exception {
        mConnectionHelper.start(1111, false, mJXcoreThaliCallbackMock);
        mConnectionHelper.stop(false, mJXcoreThaliCallbackMock);

        Field fStartStopOperationHandler = mConnectionHelper.getClass()
                .getDeclaredField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        assertThat("mStartStopOperationHandler is not null value",
                mStartStopOperationHandler, is(notNullValue()));

        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();

        Field fOutgoingSocketThreads = mConnectionModel.getClass()
                .getDeclaredField("mOutgoingSocketThreads");
        fOutgoingSocketThreads.setAccessible(true);
        CopyOnWriteArrayList<OutgoingSocketThread> mOutgoingSocketThreads =
                (CopyOnWriteArrayList<OutgoingSocketThread>)
                        fOutgoingSocketThreads.get(mConnectionModel);

        Field fOutgoingConnectionCallbacks = mConnectionModel.getClass()
                .getDeclaredField("mOutgoingConnectionCallbacks");
        fOutgoingConnectionCallbacks.setAccessible(true);
        HashMap<String, JXcoreThaliCallback> mOutgoingConnectionCallbacks =
                (HashMap<String, JXcoreThaliCallback>) fOutgoingConnectionCallbacks
                        .get(mConnectionModel);

        assertThat("OutgoingSocketThreads should be empty after executing stop method",
                mOutgoingSocketThreads.isEmpty(), is(equalTo(true)));
        assertThat("OutgoingConnectionCallbacks should be empty",
                mOutgoingConnectionCallbacks.isEmpty(), is(true));
        assertThat("Number of current connections after executing stop method should be 0",
                mConnectionHelper.getConnectionModel()
                        .getNumberOfCurrentConnections(), is(equalTo(0)));
    }

    @Test
    public void testKillAllConnections() throws Exception {
        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        IncomingSocketThreadMock mIncomingSocketThreadMock = new IncomingSocketThreadMock(
                null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        mIncomingSocketThreadMock.setPeerProperties(new PeerProperties("incoming"));
        mIncomingSocketThreadMock.threadId = 1L;

        mConnectionModel.addConnectionThread(mIncomingSocketThreadMock);

        assertThat("Number of killed incoming connection should be 1",
                mConnectionHelper.killConnections(true), is(equalTo(1)));
        assertThat("Number of outgoing connection should be 0 after killAllConnections()",
                mConnectionHelper.getConnectionModel().getNumberOfCurrentOutgoingConnections(),
                is(equalTo(0)));
        assertThat("Number of incoming connections should be 0 after killALlConnections()",
                mConnectionHelper.getConnectionModel().getNumberOfCurrentIncomingConnections(),
                is(equalTo(0)));
    }

    @Test
    public void testIsRunning() throws Exception {
        Field fConnectionManager = mConnectionHelper.getClass()
                .getDeclaredField("mConnectionManager");
        fConnectionManager.setAccessible(true);
        ConnectionManager mConnectionManager =
                (ConnectionManager) fConnectionManager.get(mConnectionHelper);

        assertThat("ConnectionManager state is NOT_STARTED", mConnectionManager.getState(),
                is(equalTo(ConnectionManager.ConnectionManagerState.NOT_STARTED)));
        assertThat("ConnectionManager state is not either WAITING_FOR_SERVICES_TO_BE_ENABLED " +
                "or RUNNING",mConnectionManager.getState(), is(not(anyOf(
                        equalTo(ConnectionManager.ConnectionManagerState
                                .WAITING_FOR_SERVICES_TO_BE_ENABLED),
                        equalTo(ConnectionManager.ConnectionManagerState
                                .RUNNING)))));

        Field fDiscoveryManager = mConnectionHelper.getClass()
                .getDeclaredField("mDiscoveryManager");
        fDiscoveryManager.setAccessible(true);
        DiscoveryManager mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);

        assertThat("mDiscoveryManager isRunning return false", mDiscoveryManager.isRunning(),
                is(false));
        assertThat("mDiscoveryManager isRunning does not return true",
                mDiscoveryManager.isRunning(), is(not(true)));
        assertThat("IsRunning returns false", mConnectionHelper.isRunning(), is(false));
        assertThat("IsRunning should not return true", mConnectionHelper.isRunning(),
                is(not(true)));

        mConnectionManager.startListeningForIncomingConnections();

        mConnectionManager.cancelAllConnectionAttempts();
        assertThat("ConnectionManager state is different than NOT_STARTED",
                mConnectionManager.getState(),
                is(not(equalTo(ConnectionManager.ConnectionManagerState.NOT_STARTED))));
        assertThat("ConnectionManager state can be either WAITING_FOR_SERVICES_TO_BE_ENABLED" +
                " or RUNNING",
                mConnectionManager.getState(),
                is(anyOf(equalTo(ConnectionManager.ConnectionManagerState
                        .WAITING_FOR_SERVICES_TO_BE_ENABLED),
                        equalTo(ConnectionManager.ConnectionManagerState
                                .RUNNING))));

        Field fState = mDiscoveryManager.getClass().getDeclaredField("mState");
        fState.setAccessible(true);
        fState.set(mDiscoveryManager, DiscoveryManager.DiscoveryManagerState.RUNNING_BLE);

        mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);

        assertThat("mDiscoveryManager isRunning return true", mDiscoveryManager.isRunning(),
                is(true));
        assertThat("mDiscoveryManager isRunning does not return false",
                mDiscoveryManager.isRunning(), is(not(false)));
        assertThat("IsRunning returns true", mConnectionHelper.isRunning(), is(true));
        assertThat("IsRunning should not return false", mConnectionHelper.isRunning(),
                is(not(false)));

        mConnectionManager.dispose();
        mDiscoveryManager.dispose();
    }

    @Test
    public void testGetConnectivityMonitorGetDiscoveryManagerGetConnectionModelGetBluetoothName()
            throws Exception {
        Field fConnectivityMonitor = mConnectionHelper.getClass()
                .getDeclaredField("mConnectivityMonitor");
        Field fDiscoveryManager = mConnectionHelper.getClass()
                .getDeclaredField("mDiscoveryManager");
        Field fConnectionModel = mConnectionHelper.getClass()
                .getDeclaredField("mConnectionModel");

        fConnectivityMonitor.setAccessible(true);
        fDiscoveryManager.setAccessible(true);
        fConnectionModel.setAccessible(true);

        ConnectivityMonitor mConnectivityMonitor =
                (ConnectivityMonitor) fConnectivityMonitor.get(mConnectionHelper);
        DiscoveryManager mDiscoveryManager =
                (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);
        ConnectionModel mConnectionModel =
                (ConnectionModel) fConnectionModel.get(mConnectionHelper);

        assertThat("mConnectivityMonitor is equal to getConnectivityMonitor",
                mConnectivityMonitor, is(equalTo(mConnectionHelper.getConnectivityMonitor())));
        assertThat("mDiscoveryManager is equal to getDiscoveryManager",
                mDiscoveryManager, is(equalTo(mConnectionHelper.getDiscoveryManager())));
        assertThat("mConnectionModel is equal to getConnectionModel",
                mConnectionModel, is(equalTo(mConnectionHelper.getConnectionModel())));

        BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        if (bluetoothAdapter != null) {
            assertThat("bluetoothAdapter.getName() is equal to getBluetoothName",
                    bluetoothAdapter.getName(), is(equalTo(mConnectionHelper.getBluetoothName())));
            assertThat("getBluetoothName is not null",
                    mConnectionHelper.getBluetoothName(), is(notNullValue()));
        } else {
            assertThat("If bluetoothAdapter is null then getBluetoothName returns null",
                    mConnectionHelper.getBluetoothName(), is(nullValue()));
        }
    }

    @Test
    public void testDisconnectOutgoingConnection() throws Exception {
        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        String bluetoothMacAddress = "00:11:22:33:44:55";
        PeerProperties mPeerProperties = new PeerProperties(bluetoothMacAddress);
        OutgoingSocketThreadMock mOutgoingSocketThreadMock = new OutgoingSocketThreadMock(
                null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        mOutgoingSocketThreadMock.setPeerProperties(mPeerProperties);
        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);

        boolean result = mConnectionHelper.disconnectOutgoingConnection("randomString");
        assertThat("No connection with peerId = randomString, should return false",
                result, is(false));

        result = mConnectionHelper.disconnectOutgoingConnection(mPeerProperties.getId());

        assertThat("Disconnect connection with proper peerId, should return true ",
                result, is(true));

        result = mConnectionHelper.disconnectOutgoingConnection(mPeerProperties.getId());

        assertThat("Connection with this peerId should be already removed, so now method " +
                        "should return false ",
                result, is(false));
    }

    @Test
    public void testHasMaximumNumberOfConnections() throws Exception {
        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        OutgoingSocketThreadMock mOutgoingSocketThreadMock = new OutgoingSocketThreadMock(
                null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        mOutgoingSocketThreadMock.setPeerProperties(new PeerProperties("00:11:22:33:44:55"));
        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);

        assertThat("mOutgoingSocketThreads size should be 1, number of max connections = 30, " +
                        "then return false",
                mConnectionHelper.hasMaximumNumberOfConnections(), is(false));

        ArrayList<OutgoingSocketThread> mOutgoingSocketThreads = new ArrayList<OutgoingSocketThread>();

        for (int i = 0; i < 30; i++) {
            mOutgoingSocketThreads.add(new OutgoingSocketThreadMock(
                    null, mListenerMock, mInputStreamMock, mOutputStreamMock));
            mOutgoingSocketThreads.get(i).setPeerProperties(
                    new PeerProperties(i + 10 + ":" + i + 10 + ":" + i + 10 + ":" + i + 10 + ":" +
                            i + 10 + ":" + i + 10));
            mConnectionModel.addConnectionThread(mOutgoingSocketThreads.get(i));
        }

        assertThat("mOutgoingSocketThreads size should be 30, number of max connections also 30, " +
                "return true",
                mConnectionHelper.hasMaximumNumberOfConnections(), is(true));
    }

    @Test
    public void testConnect() throws Exception {
        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        String bluetoothMacAddressOutgoing = "00:11:22:33:44:55";
        JXcoreThaliCallbackMock mJXcoreTHaliCallBack = new JXcoreThaliCallbackMock();
        OutgoingSocketThreadMock mOutgoingSocketThreadMock = new OutgoingSocketThreadMock(
                null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        mOutgoingSocketThreadMock
                .setPeerProperties(new PeerProperties(bluetoothMacAddressOutgoing));
        mConnectionModel.addConnectionThread(mOutgoingSocketThreadMock);

        String result = mConnectionHelper
                .connect(bluetoothMacAddressOutgoing, mJXcoreTHaliCallBack);
        assertThat(result, is(equalTo("We already have an outgoing connection to peer with ID "
                + bluetoothMacAddressOutgoing)));

        mConnectionHelper.killConnections(true);

        ArrayList<OutgoingSocketThread> mOutgoingSocketThreads = new ArrayList<OutgoingSocketThread>();

        for (int i = 0; i < 30; i++) {
            mOutgoingSocketThreads.add(new OutgoingSocketThreadMock(
                    null, mListenerMock, mInputStreamMock, mOutputStreamMock));
            mOutgoingSocketThreads.get(i).setPeerProperties(
                    new PeerProperties(i + 10 + ":" + i + 10 + ":" + i + 10 + ":" + i + 10 + ":" +
                            i + 10 + ":" + i + 10));
            mConnectionModel.addConnectionThread(mOutgoingSocketThreads.get(i));
        }

        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing, mJXcoreTHaliCallBack);
        assertThat("Maximum number of peer connections reached ",
                result, is(equalTo("Maximum number of peer connections ("
                        + mConnectionModel.getNumberOfCurrentOutgoingConnections()
                        + ") reached, please try again after disconnecting a peer")));

        mConnectionHelper.killConnections(true);
        result = mConnectionHelper.connect("abcd", mJXcoreTHaliCallBack);
        assertThat("Invalid bluetooth MAC address",
                result, is(equalTo("Invalid Bluetooth MAC address: abcd")));

        mConnectionHelper.killConnections(true);
        mOutgoingSocketThreadMock
                .setPeerProperties(new PeerProperties(bluetoothMacAddressOutgoing));
        mConnectionModel
                .addOutgoingConnectionCallback(bluetoothMacAddressOutgoing, mJXcoreTHaliCallBack);

        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing, mJXcoreTHaliCallBack);
        assertThat("Failed to add callback to the connection because such callback already exists",
                result, is(equalTo("Failed to add the callback for the connection")));

        mConnectionHelper.killConnections(true);
        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing, mJXcoreTHaliCallBack);
        assertThat("Result should be null", result, is(nullValue()));

        mConnectionHelper.killConnections(true);

        thrown.expect(NullPointerException.class);
        mConnectionHelper.connect(bluetoothMacAddressOutgoing, null); //Throws NullPointerException
    }

    @Test
    public void testToggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber()
            throws Exception {
        Field fContext = mConnectionHelper.getClass().getDeclaredField("mContext");
        fContext.setAccessible(true);
        Context mContext = (Context) fContext.get(mConnectionHelper);

        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance(mContext);

        settings.setInsecureRfcommSocketPortNumber(
                ConnectionManagerSettings.DEFAULT_ALTERNATIVE_INSECURE_RFCOMM_SOCKET_PORT);

        mConnectionHelper.toggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber();
        assertThat("getInsecureRfcommSocketPortNumber should be equal to SYSTEM_DECIDED_" +
                        "INSECURE_RFCOMM_SOCKET_PORT", settings.getInsecureRfcommSocketPortNumber(),
                is(equalTo(ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT)));

        mConnectionHelper.toggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber();
        assertThat("getInsecureRfcommSocketPortNumber should be equal to DEFAULT_ALTERNATIVE_" +
                        "INSECURE_RFCOMM_SOCKET_PORT", settings.getInsecureRfcommSocketPortNumber(),
                is(equalTo(ConnectionManagerSettings
                        .DEFAULT_ALTERNATIVE_INSECURE_RFCOMM_SOCKET_PORT)));
    }

    @Test
    public void testOnConnectionManagerStateChanged() throws Exception {
        mConnectionHelper.onConnectionManagerStateChanged(null);

        Field fStartStopOperationHandler = mConnectionHelper.getClass().
                getDeclaredField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        Field fCurrentOperation = mStartStopOperationHandler.getClass()
                .getDeclaredField("mCurrentOperation");
        Field fOperationTimeoutTimer = mStartStopOperationHandler.getClass()
                .getDeclaredField("mOperationTimeoutTimer");

        fCurrentOperation.setAccessible(true);
        fOperationTimeoutTimer.setAccessible(true);

        StartStopOperation mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);
        CountDownTimer mOperationTimeoutTimer =
                (CountDownTimer) fOperationTimeoutTimer.get(mStartStopOperationHandler);

        assertThat("mCurrentOperation should be null", mCurrentOperation,
                is(nullValue()));
        assertThat("mOperationTimeoutTimer should be null", mOperationTimeoutTimer,
                is(nullValue()));
    }

    @Test
    public void testOnConnectionTimeout() throws Exception {
        String bluetoothMacAddress = "00:11:22:33:44:55";
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();

        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        mConnectionModel.addOutgoingConnectionCallback(bluetoothMacAddress, mJXcoreThaliCallback);

        Field fContext = mConnectionHelper.getClass().getDeclaredField("mContext");
        fContext.setAccessible(true);
        Context mContext = (Context) fContext.get(mConnectionHelper);

        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance(mContext);
        settings.setInsecureRfcommSocketPortNumber(
                ConnectionManagerSettings.DEFAULT_ALTERNATIVE_INSECURE_RFCOMM_SOCKET_PORT);

        assertThat("Peer has added connection callback, should return same mJXcoreThaliCallback",
                mConnectionModel
                        .getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress),
                is(equalTo(mJXcoreThaliCallback)));

        mConnectionHelper.onConnectionTimeout(new PeerProperties(bluetoothMacAddress));
        assertThat("After calling onConnectionTimeout, should remove added connection callback " +
                "and return null",
                mConnectionModel
                        .getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress),
                is(nullValue()));
        assertThat("After calling onConnectionTimeout, " +
                        "toggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber should " +
                "be called",
                settings.getInsecureRfcommSocketPortNumber(),
                is(equalTo(ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT)));
    }

    @Test
    public void testOnConnectionFailed() throws Exception {
        String bluetoothMacAddress = "00:11:22:33:44:55";
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        String errorMessage = "ErrorMessage";
        PeerProperties mPeerProperties = new PeerProperties(bluetoothMacAddress);

        Field fContext = mConnectionHelper.getClass().getDeclaredField("mContext");
        fContext.setAccessible(true);
        Context mContext = (Context) fContext.get(mConnectionHelper);

        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance(mContext);
        settings.setInsecureRfcommSocketPortNumber(
                ConnectionManagerSettings.DEFAULT_ALTERNATIVE_INSECURE_RFCOMM_SOCKET_PORT);

        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        mConnectionModel.addOutgoingConnectionCallback(bluetoothMacAddress, mJXcoreThaliCallback);

        assertThat("Callback was successfully added",
                mConnectionModel
                        .getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress),
                is(equalTo(mJXcoreThaliCallback)));

        mConnectionHelper.onConnectionFailed(mPeerProperties, errorMessage);
        assertThat("After calling onConnectionFailed, added callback should be removed",
                mConnectionModel
                        .getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress),
                is(nullValue()));
        assertThat("Toggle method should be also called", settings
                .getInsecureRfcommSocketPortNumber(),
                is(equalTo(ConnectionManagerSettings.SYSTEM_DECIDED_INSECURE_RFCOMM_SOCKET_PORT)));
    }

    @Test
    public void testOnPermissionCheckRequired() throws Exception {
        assertThat(mConnectionHelper.onPermissionCheckRequired("randomString"), is(true));
    }

    @Test
    public void testOnDiscoveryManagerStateChanged() throws Exception {
        mConnectionHelper.onDiscoveryManagerStateChanged(
                DiscoveryManager.DiscoveryManagerState.NOT_STARTED, true, true);

        Field fStartStopOperationHandler =
                mConnectionHelper.getClass().getDeclaredField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        StartStopOperationHandler mStartStopOperationHandler =
                (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        Field fCurrentOperation =
                mStartStopOperationHandler.getClass().getDeclaredField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        StartStopOperation mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

        Field fOperationTimeoutTimer =
                mStartStopOperationHandler.getClass().getDeclaredField("mOperationTimeoutTimer");
        fOperationTimeoutTimer.setAccessible(true);
        CountDownTimer mOperationTimeoutTimer =
                (CountDownTimer) fOperationTimeoutTimer.get(mStartStopOperationHandler);

        assertThat("mStartStopOperationHandled should not be null",
                mStartStopOperationHandler, is(notNullValue()));
        assertThat("mCurrentOperation in mStartStopHandler shot be null",
                mCurrentOperation, is(nullValue()));
        assertThat("mOperationTimeoutTimer should be also null",
                mOperationTimeoutTimer, is(nullValue()));
    }

    @Test
    public void testOnProvideBluetoothMacAddressRequest() {
        thrown.expect(UnsupportedOperationException.class);
        mConnectionHelper.onProvideBluetoothMacAddressRequest("1111");
    }

    @Test
    public void testOnPeerReadyToProvideBluetoothMacAddress() {
        thrown.expect(UnsupportedOperationException.class);
        mConnectionHelper.onPeerReadyToProvideBluetoothMacAddress();
    }

    @Test
    public void testOnBluetoothMacAddressResolved() {
        thrown.expect(UnsupportedOperationException.class);
        mConnectionHelper.onBluetoothMacAddressResolved("00:11:22:33:44:55");
    }

    //TODO Write tests for onPeerDiscovered and onPeerLost
}
