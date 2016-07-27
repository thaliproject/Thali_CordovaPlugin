package io.jxcore.node;

import android.content.Context;
import android.os.CountDownTimer;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.UUID;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;

public class StartStopOperationHandlerTest {

    public static Context mContext;
    public static ConnectionManager mConnectionManager;
    public static DiscoveryManager mDiscoveryManager;
    public static ConnectionHelper mConnectionHelper;
    public static StartStopOperationHandler mStartStopOperationHandler;
    public static JXcoreThaliCallbackMock mJXcoreThaliCallback;

    String SERVICE_UUID_AS_STRING = "fa87c0d0-afac-11de-8a39-0800200c9a66";
    String BLUETOOTH_NAME = "Thali_Bluetooth";
    String SERVICE_TYPE = "Cordovap2p._tcp";
    String BLE_SERVICE_UUID_AS_STRING = "b6a44ad1-d319-4b3a-815d-8b805a47fb51";

    UUID SERVICE_UUID = UUID.fromString(SERVICE_UUID_AS_STRING);
    UUID BLE_SERVICE_UUID = UUID.fromString(BLE_SERVICE_UUID_AS_STRING);

    @Before
    public void setUp() throws Exception {
        mConnectionHelper = new ConnectionHelper();
        mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        mContext = jxcore.activity.getBaseContext();
        mConnectionManager =
                new ConnectionManager(mContext, mConnectionHelper, SERVICE_UUID, BLUETOOTH_NAME);
        mDiscoveryManager =
                new DiscoveryManager(mContext, mConnectionHelper, BLE_SERVICE_UUID, SERVICE_TYPE);
        mStartStopOperationHandler =
                new StartStopOperationHandler(mConnectionManager, mDiscoveryManager);
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

        assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));
        assertThat("mOperationTimeoutTimer should be null", mOperationTimeoutTimer,
                is(nullValue()));
    }

    @Test
    public void testExecuteStartOperation() throws Exception {
        mStartStopOperationHandler.executeStartOperation(false, mJXcoreThaliCallback);

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


        if (!mDiscoveryManager1.isBleMultipleAdvertisementSupported()) {
            assertThat("mDiscoveryManager1 state should be NOT_STARTED",
                    mDiscoveryManager1.getState(),
                    is(equalTo(DiscoveryManager.DiscoveryManagerState.NOT_STARTED)));
            assertThat("mDiscoveryManager1 should be not running",
                    mDiscoveryManager1.isRunning(),
                    is(false));
            assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));
        } else {
            assertThat("mDiscoveryManager1 state should not be NOT_STARTED",
                    mDiscoveryManager1.getState(),
                    is(not(equalTo(DiscoveryManager.DiscoveryManagerState.NOT_STARTED))));
            assertThat("mDiscoveryManager1 should be running", mDiscoveryManager1.isRunning(),
                    is(true));
            assertThat("mCurrentOperation should not be null", mCurrentOperation,
                    is(notNullValue()));
        }
    }

    @Test
    public void testExecuteStopOperation() throws Exception {
        mStartStopOperationHandler.executeStartOperation(false, mJXcoreThaliCallback);
        mStartStopOperationHandler.executeStopOperation(false, mJXcoreThaliCallback);

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

        if (!mConnectionHelper.getDiscoveryManager().isBleMultipleAdvertisementSupported()) {
            assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));

        } else {
            assertThat("mCurrentOperation should not be null", mCurrentOperation,
                    is(notNullValue()));
        }

        assertThat("mDiscoveryManager1 state should be NOT_STARTED", mDiscoveryManager1.getState(),
                is(equalTo(DiscoveryManager.DiscoveryManagerState.NOT_STARTED)));
    }

    @Test
    public void testCheckCurrentOperationStatus() throws Exception {
        Field fCurrentOperation = mStartStopOperationHandler.getClass()
                .getDeclaredField("mCurrentOperation");
        fCurrentOperation.setAccessible(true);
        fCurrentOperation.set(mStartStopOperationHandler,
                StartStopOperation.createStartOperation(true, mJXcoreThaliCallback));

        mStartStopOperationHandler.checkCurrentOperationStatus();

        StartStopOperation mCurrentOperation =
                (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);
        assertThat("mCurrentOperation is still not null", mCurrentOperation, is(notNullValue()));

        Method executeCurrentOperation = mStartStopOperationHandler.getClass()
                .getDeclaredMethod("executeCurrentOperation");
        executeCurrentOperation.setAccessible(true);
        executeCurrentOperation.invoke(mStartStopOperationHandler);

        mStartStopOperationHandler.checkCurrentOperationStatus();

        mCurrentOperation = (StartStopOperation) fCurrentOperation.get(mStartStopOperationHandler);
        assertThat("mCurrentOperation should be null", mCurrentOperation, is(nullValue()));
    }
}
