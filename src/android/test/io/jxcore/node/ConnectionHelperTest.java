package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.os.CountDownTimer;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.junit.rules.TestRule;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.ConnectionManagerSettings;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManagerSettings;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.io.IOException;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.hamcrest.CoreMatchers.anyOf;
import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;

public class ConnectionHelperTest {

    ArrayList<String> outgoingThreadsIds;
    ArrayList<String> incomingThreadsIds;
    ListenerMock mListenerMock;
    InputStreamMock mInputStreamMock;
    OutputStreamMock mOutputStreamMock;
    public static ConnectionHelper mConnectionHelper;
    static JXcoreThaliCallback mJXcoreThaliCallback;
    static StartStopOperationHandler mStartStopOperatonHandler;
    static boolean isBLESupported;
    private final static String TAG = ConnectionHelperTest.class.getName();
    private static ExecutorService mExecutor;

    @Rule
    public TestRule watcher = new TestWatcher() {
        protected void starting(Description description) {
            Log.i(TAG, "Starting test: " + description.getMethodName());
        }
    };

    public static Callable<Boolean> createCheckDiscoveryManagerRunningCallable() {
        return new Callable<Boolean>() {
            int counter = 0;

            @Override
            public Boolean call() {
                while (!mConnectionHelper.getDiscoveryManager().isRunning() &&
                    counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        Log.e(TAG, e.getMessage());
                        e.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    Log.d(TAG, "Discovery manager is running");
                    return true;
                } else {
                    Log.e(TAG, "Discovery manager didn't start after 5s!");
                    return false;
                }
            }
        };
    }

    public static Callable<Boolean> createCheckDiscoveryManagerNotRunningCallable() {
        return new Callable<Boolean>() {
            int counter = 0;

            @Override
            public Boolean call() {
                while (mConnectionHelper.getDiscoveryManager().isRunning() &&
                    counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }

                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    Log.d(TAG, "Discovery manager is NOT running");
                    return true;
                } else {
                    Log.e(TAG, "Discovery manager still running after 5s!");
                    return false;
                }
            }
        };
    }

    @Rule
    public ExpectedException thrown = ExpectedException.none();

    @BeforeClass
    public static void setUpBeforeClass() throws Exception {
        mConnectionHelper = new ConnectionHelper(new SurroundingStateObserver() {
            @Override
            public void notifyPeerAvailabilityChanged(PeerProperties peerProperties, boolean isAvailable) {

            }

            @Override
            public void notifyDiscoveryAdvertisingStateUpdateNonTcp(boolean isDiscoveryActive, boolean isAdvertisingActive) {

            }

            @Override
            public void notifyNetworkChanged(boolean isBluetoothEnabled, boolean isWifiEnabled, String bssidName, String ssidName) {

            }

            @Override
            public void notifyIncomingConnectionToPortNumberFailed(int portNumber) {

            }
        });
        isBLESupported = mConnectionHelper.getDiscoveryManager().isBleMultipleAdvertisementSupported();
        mStartStopOperatonHandler = getStartStopOperationHadler();
        mExecutor = Executors.newFixedThreadPool(5);
    }

    @Before
    public void setUp() throws Exception {
        mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        outgoingThreadsIds = new ArrayList<>();
        incomingThreadsIds = new ArrayList<>();
        mInputStreamMock = new InputStreamMock();
        mOutputStreamMock = new OutputStreamMock();
        mListenerMock = new ListenerMock();
    }

    @AfterClass
    public static void tearDownAfterClass() throws Exception {
        mConnectionHelper.dispose();
    }

    private static StartStopOperationHandler getStartStopOperationHadler() throws IllegalAccessException,
        NoSuchFieldException {
        Field fStartStopOperationHandler = mConnectionHelper.getClass()
            .getDeclaredField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        return (StartStopOperationHandler)
            fStartStopOperationHandler.get(mConnectionHelper);
    }

    private ConnectionManager getConnectionManager() throws IllegalAccessException, NoSuchFieldException {
        Field fConnectionManager = mConnectionHelper.getClass().getDeclaredField("mConnectionManager");
        fConnectionManager.setAccessible(true);
        return (ConnectionManager) fConnectionManager.get(mConnectionHelper);
    }

    private DiscoveryManager getDiscoveryManager() throws IllegalAccessException, NoSuchFieldException {
        Field fDiscoveryManager = mConnectionHelper.getClass().getDeclaredField("mDiscoveryManager");
        fDiscoveryManager.setAccessible(true);
        return (DiscoveryManager) fDiscoveryManager.get(mConnectionHelper);
    }

    private DiscoveryManagerSettings getDiscoveryManagerSettings() throws IllegalAccessException,
        NoSuchFieldException {
        Field fDiscoveryManagerSettings = mConnectionHelper.getClass()
            .getDeclaredField("mDiscoveryManagerSettings");
        fDiscoveryManagerSettings.setAccessible(true);
        return (DiscoveryManagerSettings) fDiscoveryManagerSettings.get(mConnectionHelper);
    }

    private Context getContext() throws IllegalAccessException, NoSuchFieldException {
        Field fContext = mConnectionHelper.getClass().getDeclaredField("mContext");
        fContext.setAccessible(true);
        return (Context) fContext.get(mConnectionHelper);
    }

    private StartStopOperation getCurrentOperation(StartStopOperationHandler handler) throws
        NoSuchFieldException, IllegalAccessException {
        Field fCurrentOperation = handler.getClass().getDeclaredField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        return (StartStopOperation) fCurrentOperation.get(handler);
    }

    private void checkDiscoveryManagerIsRunning() throws ExecutionException, InterruptedException {
        Future<Boolean> discoveryManagerRunning = mExecutor.submit(createCheckDiscoveryManagerRunningCallable());
        assertThat("DiscoveryManager should be running", discoveryManagerRunning.get(), is(true));
    }

    private void checkDiscoveryManagerIsNotRunning() throws ExecutionException, InterruptedException {
        Future<Boolean> discoveryManagerRunning = mExecutor.submit(createCheckDiscoveryManagerNotRunningCallable());
        assertThat("DiscoveryManager should NOT be running", discoveryManagerRunning.get(), is(true));
    }

    @Test
    public void testConstructor() throws Exception {
        assertThat("ConnectionHelper is not null value", mConnectionHelper, is(notNullValue()));
        assertThat("ConnectionModel is not null value",
            mConnectionHelper.getConnectionModel(), is(notNullValue()));
        assertThat("ConnectionManager is not null value", getConnectionManager(), is(notNullValue()));
        assertThat("DiscoveryManager is not null value", getDiscoveryManager(), is(notNullValue()));
        assertThat("DiscoveryManagerSettings is not null value",
            getDiscoveryManagerSettings(), is(notNullValue()));
        assertThat("Context is not null value", getContext(), is(notNullValue()));
    }

    @Test
    public void testDispose() throws Exception {
        assertThat("Start method returns true",
            mConnectionHelper.start(1111, isBLESupported, mJXcoreThaliCallback), is(equalTo(true)));
        if (isBLESupported) {
            checkDiscoveryManagerIsRunning();
        }
        mConnectionHelper.dispose();
        Thread.sleep(5000); //Wait for connectionHelper to dispose

        checkDiscoveryManagerIsNotRunning();

        DiscoveryManager discoveryManager = getDiscoveryManager();
        ConnectionManager connectionManager = getConnectionManager();
        StartStopOperationHandler startStopOperationHandler = getStartStopOperationHadler();

        assertThat("DiscoveryManager state is equal to NOT_STARTED",
            discoveryManager.getState().toString(), is(equalTo("NOT_STARTED")));
        assertThat("ConnectionManager state is equal to NOT_STARTED",
            connectionManager.getState().toString(), is(equalTo("NOT_STARTED")));
        assertThat("CurrentOperation in StartStopOperationHandler is null value",
            getCurrentOperation(startStopOperationHandler), is(nullValue()));
    }

    @Test
    public void testStart() throws Exception {
        assertThat("Start method returns true",
            mConnectionHelper.start(1111, isBLESupported, mJXcoreThaliCallback), is(equalTo(true)));

        if (isBLESupported) {
            checkDiscoveryManagerIsRunning();
        }

        Field fServerPortNumber = mConnectionHelper.getClass().getDeclaredField("mServerPortNumber");
        Field fPowerUpBleDiscoveryTimer = mConnectionHelper.getClass()
            .getDeclaredField("mPowerUpBleDiscoveryTimer");

        fServerPortNumber.setAccessible(true);
        fPowerUpBleDiscoveryTimer.setAccessible(true);

        int serverPortNumber = fServerPortNumber.getInt(mConnectionHelper);
        CountDownTimer powerUpBleDiscoveryTimer = (CountDownTimer) fPowerUpBleDiscoveryTimer.
            get(mConnectionHelper);
        StartStopOperationHandler startStopOperationHandler = getStartStopOperationHadler();

        assertThat("Port number has a proper value", serverPortNumber, is(equalTo(1111)));
        assertThat("CountDownTimer is null value", powerUpBleDiscoveryTimer, is(nullValue()));
        assertThat("StartStopOperation handler is not null value", startStopOperationHandler,
            is(notNullValue()));

        assertThat("DiscoveryManager1 isRunning should return " + isBLESupported,
            mConnectionHelper.getDiscoveryManager().isRunning(), is(isBLESupported));

        mConnectionHelper.stop(false, mJXcoreThaliCallback);

        checkDiscoveryManagerIsNotRunning();

        assertThat("Start method returns true",
            mConnectionHelper.start(-1111, isBLESupported, mJXcoreThaliCallback),
            is(equalTo(true)));

        if (isBLESupported) {
            checkDiscoveryManagerIsRunning();
        }

        serverPortNumber = fServerPortNumber.getInt(mConnectionHelper);
        powerUpBleDiscoveryTimer = (CountDownTimer) fPowerUpBleDiscoveryTimer.get(mConnectionHelper);
        startStopOperationHandler = getStartStopOperationHadler();

        assertThat("Port number has a proper value, not changed because -1111 < 0", serverPortNumber,
            is(equalTo(1111)));
        assertThat("CountDownTimer is null value", powerUpBleDiscoveryTimer, is(nullValue()));
        assertThat("StartStopOperation handler is not null value",
            startStopOperationHandler, is(notNullValue()));
        assertThat("DiscoveryManager isRunning should return " + isBLESupported,
            mConnectionHelper.getDiscoveryManager().isRunning(), is(isBLESupported));
    }

    @SuppressWarnings("unchecked")
    @Test
    public void testStop() throws Exception {
        mConnectionHelper.start(1111, isBLESupported, mJXcoreThaliCallback);

        if (isBLESupported) {
            checkDiscoveryManagerIsRunning();
        }

        mConnectionHelper.stop(false, mJXcoreThaliCallback);

        checkDiscoveryManagerIsNotRunning();

        StartStopOperationHandler startStopOperationHandler = getStartStopOperationHadler();

        assertThat("mStartStopOperationHandler is not null value", startStopOperationHandler,
            is(notNullValue()));

        ConnectionModel connectionModel = mConnectionHelper.getConnectionModel();

        CopyOnWriteArrayList<OutgoingSocketThread> outgoingSocketThreads =
            getOutgoingSocketThreads(connectionModel);
        Field fOutgoingConnectionCallbacks = connectionModel.getClass()
            .getDeclaredField("mOutgoingConnectionCallbacks");
        fOutgoingConnectionCallbacks.setAccessible(true);
        HashMap<String, JXcoreThaliCallback> mOutgoingConnectionCallbacks =
            (HashMap<String, JXcoreThaliCallback>) fOutgoingConnectionCallbacks.get(connectionModel);

        assertThat("OutgoingSocketThreads should be empty after executing stop method",
            outgoingSocketThreads.isEmpty(), is(equalTo(true)));
        assertThat("OutgoingConnectionCallbacks should be empty",
            mOutgoingConnectionCallbacks.isEmpty(), is(true));
        assertThat("Number of current connections after executing stop method should be 0",
            mConnectionHelper.getConnectionModel().getNumberOfCurrentConnections(), is(equalTo(0)));
    }

    @SuppressWarnings("unchecked")
    private CopyOnWriteArrayList<OutgoingSocketThread> getOutgoingSocketThreads(ConnectionModel connectionModel)
        throws NoSuchFieldException, IllegalAccessException {
        Field fOutgoingSocketThreads = connectionModel.getClass().getDeclaredField("mOutgoingSocketThreads");
        fOutgoingSocketThreads.setAccessible(true);
        return (CopyOnWriteArrayList<OutgoingSocketThread>) fOutgoingSocketThreads.get(connectionModel);
    }

    @Test
    public void testKillAllConnections() throws Exception {
        ConnectionModel mConnectionModel = mConnectionHelper.getConnectionModel();
        IncomingSocketThreadMock incomingSocketThreadMock = new IncomingSocketThreadMock(
            null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        incomingSocketThreadMock.setPeerProperties(new PeerProperties("incoming"));
        incomingSocketThreadMock.threadId = 1L;

        mConnectionModel.addConnectionThread(incomingSocketThreadMock);

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
        ConnectionManager connectionManager = getConnectionManager();

        assertThat("ConnectionManager state is NOT_STARTED", connectionManager.getState(),
            is(equalTo(ConnectionManager.ConnectionManagerState.NOT_STARTED)));
        assertThat("ConnectionManager state is not either WAITING_FOR_SERVICES_TO_BE_ENABLED " +
                "or RUNNING",
            connectionManager.getState(), is(not(anyOf(
                equalTo(ConnectionManager.ConnectionManagerState.WAITING_FOR_SERVICES_TO_BE_ENABLED),
                equalTo(ConnectionManager.ConnectionManagerState.RUNNING)))));

        DiscoveryManager discoveryManager = getDiscoveryManager();

        assertThat("DiscoveryManager isRunning return false", discoveryManager.isRunning(),
            is(false));
        assertThat("DiscoveryManager isRunning does not return true",
            discoveryManager.isRunning(), is(not(true)));
        assertThat("IsRunning returns false", mConnectionHelper.isRunning(), is(false));
        assertThat("IsRunning should not return true", mConnectionHelper.isRunning(),
            is(not(true)));

        connectionManager.startListeningForIncomingConnections();

        connectionManager.cancelAllConnectionAttempts();
        assertThat("ConnectionManager state is different than NOT_STARTED",
            connectionManager.getState(),
            is(not(equalTo(ConnectionManager.ConnectionManagerState.NOT_STARTED))));
        assertThat("ConnectionManager state can be either WAITING_FOR_SERVICES_TO_BE_ENABLED" +
                " or RUNNING",
            connectionManager.getState(),
            is(anyOf(equalTo(ConnectionManager.ConnectionManagerState
                    .WAITING_FOR_SERVICES_TO_BE_ENABLED),
                equalTo(ConnectionManager.ConnectionManagerState
                    .RUNNING))));

        Field fState = discoveryManager.getClass().getDeclaredField("mState");
        fState.setAccessible(true);
        fState.set(discoveryManager, DiscoveryManager.DiscoveryManagerState.RUNNING_BLE);

        discoveryManager = getDiscoveryManager();

        assertThat("DiscoveryManager isRunning return true", discoveryManager.isRunning(),
            is(true));
        assertThat("DiscoveryManager isRunning does not return false",
            discoveryManager.isRunning(), is(not(false)));
        assertThat("IsRunning returns true", mConnectionHelper.isRunning(), is(true));
        assertThat("IsRunning should not return false", mConnectionHelper.isRunning(),
            is(not(false)));
    }

    @Test
    public void testGetConnectivityMonitorGetDiscoveryManagerGetConnectionModelGetBluetoothName()
        throws Exception {
        Field fConnectivityMonitor = mConnectionHelper.getClass()
            .getDeclaredField("mConnectivityMonitor");
        Field fConnectionModel = mConnectionHelper.getClass()
            .getDeclaredField("mConnectionModel");

        fConnectivityMonitor.setAccessible(true);
        fConnectionModel.setAccessible(true);

        ConnectivityMonitor connectivityMonitor =
            (ConnectivityMonitor) fConnectivityMonitor.get(mConnectionHelper);
        DiscoveryManager discoveryManager = getDiscoveryManager();
        ConnectionModel connectionModel =
            (ConnectionModel) fConnectionModel.get(mConnectionHelper);

        assertThat("ConnectivityMonitor is equal to getConnectivityMonitor",
            connectivityMonitor, is(equalTo(mConnectionHelper.getConnectivityMonitor())));
        assertThat("DiscoveryManager is equal to getDiscoveryManager",
            discoveryManager, is(equalTo(mConnectionHelper.getDiscoveryManager())));
        assertThat("ConnectionModel is equal to getConnectionModel",
            connectionModel, is(equalTo(mConnectionHelper.getConnectionModel())));

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
        ConnectionModel connectionModel = mConnectionHelper.getConnectionModel();
        String bluetoothMacAddress = "00:11:22:33:44:55";
        PeerProperties peerProperties = new PeerProperties(bluetoothMacAddress);
        OutgoingSocketThreadMock outgoingSocketThreadMock = new OutgoingSocketThreadMock(
            null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        outgoingSocketThreadMock.setPeerProperties(peerProperties);
        connectionModel.addConnectionThread(outgoingSocketThreadMock);

        boolean result = mConnectionHelper.disconnectOutgoingConnection("randomString");
        assertThat("No connection with peerId = randomString, should return false",
            result, is(false));

        result = mConnectionHelper.disconnectOutgoingConnection(peerProperties.getId());

        assertThat("Disconnect connection with proper peerId, should return true ",
            result, is(true));

        result = mConnectionHelper.disconnectOutgoingConnection(peerProperties.getId());

        assertThat("Connection with this peerId should be already removed, so now method " +
                "should return false ",
            result, is(false));
    }

    @Test
    public void testHasMaximumNumberOfConnections() throws Exception {
        ConnectionModel connectionModel = mConnectionHelper.getConnectionModel();
        OutgoingSocketThreadMock outgoingSocketThreadMock = new OutgoingSocketThreadMock(
            null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        outgoingSocketThreadMock.setPeerProperties(new PeerProperties("00:11:22:33:44:55"));
        connectionModel.addConnectionThread(outgoingSocketThreadMock);

        assertThat("OutgoingSocketThreads size should be 1, number of max connections = 30, " +
                "then return false",
            mConnectionHelper.hasMaximumNumberOfConnections(), is(false));

        List<OutgoingSocketThread> outgoingSocketThreads = new ArrayList<OutgoingSocketThread>();
        addMaxNumberOfConnections(outgoingSocketThreads, connectionModel);

        assertThat("OutgoingSocketThreads size should be 30, number of max connections also 30, " +
                "return true",
            mConnectionHelper.hasMaximumNumberOfConnections(), is(true));
    }

    private void addMaxNumberOfConnections(List<OutgoingSocketThread> outgoingSocketThreads,
                                           ConnectionModel connectionModel) throws IOException {
        for (int i = 0; i < 30; i++) {
            outgoingSocketThreads.add(new OutgoingSocketThreadMock(
                null, mListenerMock, mInputStreamMock, mOutputStreamMock));
            outgoingSocketThreads.get(i).setPeerProperties(
                new PeerProperties(i + 10 + ":" + i + 10 + ":" + i + 10 + ":" + i + 10 + ":" +
                    i + 10 + ":" + i + 10));
            connectionModel.addConnectionThread(outgoingSocketThreads.get(i));
        }
    }

    @Test
    public void testConnect() throws Exception {
        ConnectionModel connectionModel = mConnectionHelper.getConnectionModel();
        String bluetoothMacAddressOutgoing = "00:11:22:33:44:55";
        JXcoreThaliCallbackMock jxCoreThaliCallBack = new JXcoreThaliCallbackMock();
        OutgoingSocketThreadMock outgoingSocketThreadMock = new OutgoingSocketThreadMock(
            null, mListenerMock, mInputStreamMock, mOutputStreamMock);

        outgoingSocketThreadMock
            .setPeerProperties(new PeerProperties(bluetoothMacAddressOutgoing));
        connectionModel.addConnectionThread(outgoingSocketThreadMock);

        String result = mConnectionHelper
            .connect(bluetoothMacAddressOutgoing, jxCoreThaliCallBack);
        assertThat(result, is(equalTo("Already connect(ing/ed)")));

        mConnectionHelper.killConnections(true);

        List<OutgoingSocketThread> outgoingSocketThreads = new ArrayList<OutgoingSocketThread>();
        addMaxNumberOfConnections(outgoingSocketThreads, connectionModel);

        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing, jxCoreThaliCallBack);
        assertThat("Maximum number of peer connections reached ",
            result, is(equalTo("Maximum number of peer connections ("
                + connectionModel.getNumberOfCurrentOutgoingConnections()
                + ") reached, please try again after disconnecting a peer")));

        mConnectionHelper.killConnections(true);
        result = mConnectionHelper.connect("abcd", jxCoreThaliCallBack);
        assertThat("Invalid bluetooth MAC address",
            result, is(equalTo("Invalid Bluetooth MAC address: abcd")));

        mConnectionHelper.killConnections(true);
        outgoingSocketThreadMock
            .setPeerProperties(new PeerProperties(bluetoothMacAddressOutgoing));
        connectionModel
            .addOutgoingConnectionCallback(bluetoothMacAddressOutgoing, jxCoreThaliCallBack);

        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing, jxCoreThaliCallBack);
        assertThat("Failed to add callback to the connection because such callback already exists",
            result, is(equalTo("Failed to add the callback for the connection")));

        mConnectionHelper.killConnections(true);
        result = mConnectionHelper.connect(bluetoothMacAddressOutgoing, jxCoreThaliCallBack);
        assertThat("Result should be null", result, is(nullValue()));

        mConnectionHelper.killConnections(true);

        thrown.expect(NullPointerException.class);
        mConnectionHelper.connect(bluetoothMacAddressOutgoing, null); //Throws NullPointerException
    }

    @Test
    public void testToggleBetweenSystemDecidedAndAlternativeInsecureRfcommPortNumber()
        throws Exception {
        Context context = getContext();

        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance(context);

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

        StartStopOperationHandler startStopOperationHandler = getStartStopOperationHadler();

        StartStopOperation currentOperation = getCurrentOperation(startStopOperationHandler);
        CountDownTimer operationTimeoutTimer = getOperationTimeout(startStopOperationHandler);
        assertThat("CurrentOperation should be null", currentOperation, is(nullValue()));
        assertThat("OperationTimeoutTimer should be null", operationTimeoutTimer, is(nullValue()));
    }

    private CountDownTimer getOperationTimeout(StartStopOperationHandler handler) throws
        IllegalAccessException, NoSuchFieldException {
        Field fOperationTimeoutTimer = handler.getClass().getDeclaredField("mOperationTimeoutTimer");
        fOperationTimeoutTimer.setAccessible(true);
        return (CountDownTimer) fOperationTimeoutTimer.get(handler);
    }

    @Test
    public void testOnConnectionTimeout() throws Exception {
        String bluetoothMacAddress = "00:11:22:33:44:55";
        JXcoreThaliCallback jxCoreThaliCallback = new JXcoreThaliCallbackMock();

        ConnectionModel connectionModel = mConnectionHelper.getConnectionModel();
        connectionModel.addOutgoingConnectionCallback(bluetoothMacAddress, jxCoreThaliCallback);

        Context context = getContext();

        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance(context);
        settings.setInsecureRfcommSocketPortNumber(
            ConnectionManagerSettings.DEFAULT_ALTERNATIVE_INSECURE_RFCOMM_SOCKET_PORT);

        assertThat("Peer has added connection callback, should return same mJXcoreThaliCallback",
            connectionModel
                .getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress),
            is(equalTo(jxCoreThaliCallback)));

        mConnectionHelper.onConnectionTimeout(new PeerProperties(bluetoothMacAddress));
        assertThat("After calling onConnectionTimeout, should remove added connection callback " +
                "and return null",
            connectionModel
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
        JXcoreThaliCallback jxCoreThaliCallback = new JXcoreThaliCallbackMock();
        String errorMessage = "ErrorMessage";
        PeerProperties peerProperties = new PeerProperties(bluetoothMacAddress);

        Context context = getContext();

        ConnectionManagerSettings settings = ConnectionManagerSettings.getInstance(context);
        settings.setInsecureRfcommSocketPortNumber(
            ConnectionManagerSettings.DEFAULT_ALTERNATIVE_INSECURE_RFCOMM_SOCKET_PORT);

        ConnectionModel connectionModel = mConnectionHelper.getConnectionModel();
        connectionModel.addOutgoingConnectionCallback(bluetoothMacAddress, jxCoreThaliCallback);

        assertThat("Callback was successfully added",
            connectionModel
                .getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress),
            is(equalTo(jxCoreThaliCallback)));

        mConnectionHelper.onConnectionFailed(peerProperties, errorMessage);
        assertThat("After calling onConnectionFailed, added callback should be removed",
            connectionModel
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

        StartStopOperationHandler startStopOperationHandler = getStartStopOperationHadler();

        StartStopOperation currentOperation = getCurrentOperation(startStopOperationHandler);

        CountDownTimer operationTimeout = getOperationTimeout(startStopOperationHandler);

        assertThat("StartStopOperationHandled should not be null",
            startStopOperationHandler, is(notNullValue()));
        assertThat("CurrentOperation in mStartStopHandler shot be null",
            currentOperation, is(nullValue()));
        assertThat("OperationTimeoutTimer should be also null", operationTimeout, is(nullValue()));
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


    @Test()
    public void testListenToConnectivityChanges() {
        ConnectionHelper helper = null;
        try {
            TestSurroundingStateObserver stateObserver = new TestSurroundingStateObserver();
            helper = new ConnectionHelper(stateObserver);
            helper.listenToConnectivityEvents(); //hidden updateConnectivityInfo call

            assertThat("Network changed should be called", stateObserver.networkChangedCalled, is(true));
            stateObserver.resetState();

            helper.getConnectivityMonitor().updateConnectivityInfo(false);

            assertThat("Network changed should not be called", stateObserver.networkChangedCalled, is(false));

            stateObserver.resetState();
            helper.getConnectivityMonitor().updateConnectivityInfo(true);

            assertThat("Network changed should be called", stateObserver.networkChangedCalled, is(true));
        } finally {
            if (helper != null) {
                helper.dispose();
            }
        }

    }

    private static class TestSurroundingStateObserver implements SurroundingStateObserver {

        private boolean networkChangedCalled = false;

        @Override
        public void notifyPeerAvailabilityChanged(PeerProperties peerProperties, boolean isAvailable) {

        }

        @Override
        public void notifyDiscoveryAdvertisingStateUpdateNonTcp(boolean isDiscoveryActive, boolean isAdvertisingActive) {

        }

        @Override
        public void notifyNetworkChanged(boolean isBluetoothEnabled, boolean isWifiEnabled, String bssidName, String ssidName) {
            networkChangedCalled = true;
        }

        @Override
        public void notifyIncomingConnectionToPortNumberFailed(int portNumber) {

        }

        void resetState() {
            networkChangedCalled = false;
        }
    }
}
