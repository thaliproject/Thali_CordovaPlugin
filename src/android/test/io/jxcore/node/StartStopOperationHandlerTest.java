package io.jxcore.node;

import android.os.CountDownTimer;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TestRule;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;

public class StartStopOperationHandlerTest {

    ConnectionManager mConnectionManager;
    DiscoveryManager mDiscoveryManager;
    StartStopOperationHandler mStartStopOperationHandler;
    JXcoreThaliCallbackMock mJXcoreThaliCallback;
    static ConnectionHelper mConnectionHelper;
    static StartStopOperationHandler mStartStopOperatonHandler;
    static long mOperationTimeout;
    static boolean isBLESupported;
    static String mTag = StartStopOperationHandlerTest.class.getName();
    static ExecutorService mExecutor;

    public static Callable<Boolean> createCheckDiscoveryManagerRunningCallable() {
        return new Callable<Boolean>() {
            int counter = 0;
            @Override
            public Boolean call() {
                while (!mConnectionHelper
                    .getDiscoveryManager().isRunning() && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e){
                        e.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(mTag, "Discovery manager didn't start after 5s!");
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
                while (mConnectionHelper
                    .getDiscoveryManager().isRunning() && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e){
                        e.printStackTrace();
                        return false;
                    }
                }
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(mTag, "Discovery manager still running after 5s!");
                    return false;
                }
            }
        };
    }

    @Rule
    public TestRule watcher = new TestWatcher() {
        protected void starting(Description description) {
            Log.i(mTag, "Starting test: " + description.getMethodName());
        }
    };

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
        isBLESupported =
            mConnectionHelper.getDiscoveryManager().isBleMultipleAdvertisementSupported();

        Field fStartStopOperationHandler = mConnectionHelper.getClass().getDeclaredField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        mStartStopOperatonHandler = (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);

        Field fOperationTimeout = mStartStopOperatonHandler.getClass()
            .getDeclaredField("OPERATION_TIMEOUT_IN_MILLISECONDS");
        fOperationTimeout.setAccessible(true);
        mOperationTimeout = fOperationTimeout.getLong(mStartStopOperatonHandler);

        mExecutor = Executors.newFixedThreadPool(5);
    }

    @Before
    public void setUp() throws Exception {
        mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        mDiscoveryManager = mConnectionHelper.getDiscoveryManager();

        Field fConnectionManager =
            mConnectionHelper.getClass().getDeclaredField("mConnectionManager");
        fConnectionManager.setAccessible(true);
        mConnectionManager = (ConnectionManager) fConnectionManager.get(mConnectionHelper);

        Field fStartStopOperationHandler =
            mConnectionHelper.getClass().getDeclaredField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        mStartStopOperationHandler =
            (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);
    }

    @AfterClass
    public static void tearDownAfterClass() throws Exception {
        mConnectionHelper.dispose();
    }

    @Test
    public void testConstructor() throws Exception {
        Field fConnectionManager = mStartStopOperationHandler.getClass()
            .getDeclaredField("mConnectionManager");
        Field fDiscoveryManager = mStartStopOperationHandler.getClass()
            .getDeclaredField("mDiscoveryManager");

        fConnectionManager.setAccessible(true);
        fDiscoveryManager.setAccessible(true);

        ConnectionManager mConnectionManager1 =
            (ConnectionManager) fConnectionManager.get(mStartStopOperationHandler);
        DiscoveryManager mDiscoveryManager1 =
            (DiscoveryManager) fDiscoveryManager.get(mStartStopOperationHandler);

        assertThat("mStartStopOperationHandler should not be null", mStartStopOperationHandler,
            is(notNullValue()));
        assertThat("mConnectionManager1 should not be null", mConnectionManager1,
            is(notNullValue()));
        assertThat("mConnectionManager1 should be equal to mConnectionManager",
            mConnectionManager1, is(equalTo(mConnectionManager)));
        assertThat("mDiscoveryManager1 should not be null", mDiscoveryManager1,
            is(notNullValue()));
        assertThat("mDiscoveryManager1 should be equal to mDiscoveryManager",
            mDiscoveryManager1, is(equalTo(mDiscoveryManager)));
    }

    @Test
    public void testCancelCurrentOperation() throws Exception {
        mStartStopOperationHandler.cancelCurrentOperation();

        Field fCurrentOperation = mStartStopOperationHandler.getClass()
            .getDeclaredField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        StartStopOperation mCurrentOperation =
            (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

        Field fOperationTimeoutTimer =
            mStartStopOperationHandler.getClass().getDeclaredField("mOperationTimeoutTimer");
        fOperationTimeoutTimer.setAccessible(true);
        CountDownTimer mOperationTimeoutTimer =
            (CountDownTimer) fOperationTimeoutTimer.get(mStartStopOperationHandler);

        assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));
        assertThat("mOperationTimeoutTimer should be null", mOperationTimeoutTimer,
            is(nullValue()));
    }

    @Test
    public void testExecuteStartOperation() throws Exception {
        Future<Boolean> mFuture;
        mStartStopOperationHandler.executeStartOperation(isBLESupported, mJXcoreThaliCallback);

        if (isBLESupported) {
            mFuture = mExecutor.submit(createCheckDiscoveryManagerRunningCallable());
            assertThat("DiscoveryManager should be running", mFuture.get(), is(true));
        }

        /* After 3s mCurrentOperation should be null. This is defined in
         * StartStopOperationHandler, field OPERATION_TIMEOUT_IN_MILLISECONDS */

        Thread.sleep(mOperationTimeout);

        Field fDiscoveryManager =
            mStartStopOperationHandler.getClass().getDeclaredField("mDiscoveryManager");
        Field fCurrentOperation = mStartStopOperationHandler.getClass()
            .getDeclaredField("mCurrentOperation");

        fDiscoveryManager.setAccessible(true);
        fCurrentOperation.setAccessible(true);

        DiscoveryManager mDiscoveryManager1 =
            (DiscoveryManager) fDiscoveryManager.get(mStartStopOperationHandler);
        StartStopOperation mCurrentOperation =
            (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

        assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));

        if (!isBLESupported) {
            assertThat("mDiscoveryManager1 state should be NOT_STARTED",
                mDiscoveryManager1.getState(),
                is(equalTo(DiscoveryManager.DiscoveryManagerState.NOT_STARTED)));
            assertThat("mDiscoveryManager1 should be not running",
                mDiscoveryManager1.isRunning(),
                is(false));
        } else {
            assertThat("mDiscoveryManager1 state should not be NOT_STARTED",
                mDiscoveryManager1.getState(),
                is(not(equalTo(DiscoveryManager.DiscoveryManagerState.NOT_STARTED))));
            assertThat("mDiscoveryManager1 should be running", mDiscoveryManager1.isRunning(),
                is(true));
        }
    }

    @Test
    public void testExecuteStopOperation() throws Exception {
        Future<Boolean> mFuture;

        mStartStopOperationHandler.executeStartOperation(isBLESupported, mJXcoreThaliCallback);

        if (isBLESupported) {
            mFuture = mExecutor.submit(createCheckDiscoveryManagerRunningCallable());
            assertThat("DiscoveryManager should be running", mFuture.get(), is(true));
        }

        Thread.sleep(mOperationTimeout);

        mStartStopOperationHandler.executeStopOperation(false, mJXcoreThaliCallback);

        mFuture = mExecutor.submit(createCheckDiscoveryManagerNotRunningCallable());

        assertThat("DiscoveryManager should not be running", mFuture.get(), is(true));

        Field fCurrentOperation = mStartStopOperationHandler.getClass()
            .getDeclaredField("mCurrentOperation");
        Field fDiscoveryManager =
            mStartStopOperationHandler.getClass().getDeclaredField("mDiscoveryManager");

        fCurrentOperation.setAccessible(true);
        fDiscoveryManager.setAccessible(true);

        StartStopOperation mCurrentOperation =
            (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);
        DiscoveryManager mDiscoveryManager1 =
            (DiscoveryManager) fDiscoveryManager.get(mStartStopOperationHandler);

        assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));

        assertThat("mDiscoveryManager1 state should be NOT_STARTED", mDiscoveryManager1.getState(),
            is(equalTo(DiscoveryManager.DiscoveryManagerState.NOT_STARTED)));
    }

    @Test
    public void testCheckCurrentOperationStatus() throws Exception {
        Field fCurrentOperation = mStartStopOperationHandler.getClass()
            .getDeclaredField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);

        fCurrentOperation.set(mStartStopOperationHandler,
            StartStopOperation.createStartOperation(isBLESupported, mJXcoreThaliCallback));

        mStartStopOperationHandler.processCurrentOperationStatus();

        Method executeCurrentOperation = mStartStopOperationHandler.getClass()
            .getDeclaredMethod("executeCurrentOperation");
        executeCurrentOperation.setAccessible(true);
        executeCurrentOperation.invoke(mStartStopOperationHandler);

        StartStopOperation mCurrentOperation =
            (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

        if (!isBLESupported) {
            assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));
        } else {
            fCurrentOperation.set(mStartStopOperationHandler,
                StartStopOperation.createStartOperation(true, mJXcoreThaliCallback));
            mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

            assertThat("mCurrentOperation should not be null", mCurrentOperation,
                is(notNullValue()));

            Thread.sleep(mOperationTimeout);
            mStartStopOperationHandler.processCurrentOperationStatus();

            mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

            assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));
        }
    }
}
