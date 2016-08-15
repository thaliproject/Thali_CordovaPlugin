package io.jxcore.node;

import android.os.CountDownTimer;

import org.junit.After;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;

public class StartStopOperationHandlerTest {

    private ConnectionManager mConnectionManager;
    private DiscoveryManager mDiscoveryManager;
    private ConnectionHelper mConnectionHelper;
    private StartStopOperationHandler mStartStopOperationHandler;
    private JXcoreThaliCallbackMock mJXcoreThaliCallback;

    @BeforeClass
    public static void setUpBeforeClass() throws Exception {
        Thread.sleep(5000);
    }

    @Before
    public void setUp() throws Exception {

        mConnectionHelper = new ConnectionHelper();
        mJXcoreThaliCallback = new JXcoreThaliCallbackMock();

        mDiscoveryManager = mConnectionHelper.getDiscoveryManager();

        Field fConnectionManager = mConnectionHelper.getClass().getDeclaredField("mConnectionManager");
        fConnectionManager.setAccessible(true);
        mConnectionManager = (ConnectionManager) fConnectionManager.get(mConnectionHelper);

        Field fStartStopOperationHandler = mConnectionHelper.getClass().getDeclaredField("mStartStopOperationHandler");
        fStartStopOperationHandler.setAccessible(true);
        mStartStopOperationHandler = (StartStopOperationHandler) fStartStopOperationHandler.get(mConnectionHelper);
    }

    @After
    public void tearDown() throws Exception {
        mConnectionHelper.killConnections(true);
        mConnectionHelper.stop(false, mJXcoreThaliCallback);
        mConnectionHelper.dispose();
        mConnectionHelper.getDiscoveryManager().stop();
        mConnectionHelper.getDiscoveryManager().stopAdvertising();
        mConnectionHelper.getDiscoveryManager().stopDiscovery();
        mConnectionHelper.getDiscoveryManager().dispose();
        mDiscoveryManager.stop();
        mDiscoveryManager.stopDiscovery();
        mDiscoveryManager.stopAdvertising();
        mDiscoveryManager.dispose();
        mConnectionManager.dispose();
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

        assertThat("mCurrentOperation should be null3", mCurrentOperation, is(nullValue()));
        assertThat("mOperationTimeoutTimer should be null", mOperationTimeoutTimer,
                is(nullValue()));
    }

    @Test
    public void testExecuteStartOperation() throws Exception {
        mStartStopOperationHandler.executeStartOperation(false, mJXcoreThaliCallback);
        Thread.sleep(3000); //After 3s mCurrentOperation should be null

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

        assertThat("mCurrentOperation should be null2", mCurrentOperation, is(nullValue()));


        if (!mDiscoveryManager1.isBleMultipleAdvertisementSupported()) {
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
        mStartStopOperationHandler.executeStartOperation(false, mJXcoreThaliCallback);
        mStartStopOperationHandler.executeStopOperation(false, mJXcoreThaliCallback);
        Thread.sleep(3000); //After 3s mCurrentOperation should be null

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
                StartStopOperation.createStartOperation(false, mJXcoreThaliCallback));

        mStartStopOperationHandler.checkCurrentOperationStatus();

        Method executeCurrentOperation = mStartStopOperationHandler.getClass()
                .getDeclaredMethod("executeCurrentOperation");
        executeCurrentOperation.setAccessible(true);
        executeCurrentOperation.invoke(mStartStopOperationHandler);

        Thread.sleep(3000);
        fCurrentOperation.set(mStartStopOperationHandler, StartStopOperation.createStartOperation(false, mJXcoreThaliCallback));

        StartStopOperation mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);

        assertThat("mCurrentOperation should not be null1", mCurrentOperation, is(notNullValue()));

        mStartStopOperationHandler.checkCurrentOperationStatus();
        
        Thread.sleep(3000);
        fCurrentOperation = mStartStopOperationHandler.getClass()
                .getDeclaredField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        mCurrentOperation = (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);
        
        assertThat("mCurrentOperation should be null1", mCurrentOperation, is(nullValue()));
    }
}
