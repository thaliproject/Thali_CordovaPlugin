package io.jxcore.node;

import android.util.Log;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TestRule;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;

import java.lang.reflect.Field;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;

public class StartStopOperationTest {

    String mTag = StartStopOperationTest.class.getName();

    @Rule
    public TestRule watcher = new TestWatcher() {
        protected void starting(Description description) {
            Log.i(mTag, "Starting test: " + description.getMethodName());
        }
    };

    @Test
    public void testCreateStartOperation() throws Exception {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);

        Field fCallback = mStartStopOperation.getClass().getDeclaredField("mCallback");
        Field fIsStartOperation = mStartStopOperation.getClass()
            .getDeclaredField("mIsStartOperation");
        Field fShouldStartOrStopListeningToAdvertisementsOnly = mStartStopOperation.getClass()
            .getDeclaredField("mShouldAffectListeningToAdvertisementsOnly");

        fCallback.setAccessible(true);
        fIsStartOperation.setAccessible(true);
        fShouldStartOrStopListeningToAdvertisementsOnly.setAccessible(true);

        JXcoreThaliCallback mCallback = (JXcoreThaliCallback) fCallback.get(mStartStopOperation);
        boolean mIsStartOperation = fIsStartOperation.getBoolean(mStartStopOperation);
        boolean mShouldAffectListeningToAdvertisementsOnly =
            fShouldStartOrStopListeningToAdvertisementsOnly.getBoolean(mStartStopOperation);

        assertThat("mJXcoreThaliCallback should not be null", mJXcoreThaliCallback,
            is(notNullValue()));
        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("mCallback should not be null", mCallback, is(notNullValue()));
        assertThat("mCallback should be equal to mJXcoreThaliCallback", mCallback,
            is(equalTo(mJXcoreThaliCallback)));
        assertThat("mIsStartOperation should not be null", mIsStartOperation, is(notNullValue()));
        assertThat("mIsStartOperation should be true", mIsStartOperation, is(true));
        assertThat("mIsStartOperation should not be false", mIsStartOperation, is(not(false)));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be null",
            mShouldAffectListeningToAdvertisementsOnly, is(notNullValue()));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should be true",
            mShouldAffectListeningToAdvertisementsOnly, is(true));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be false",
            mShouldAffectListeningToAdvertisementsOnly, is(not(false)));

        mStartStopOperation =
            StartStopOperation.createStartOperation(false, mJXcoreThaliCallback);
        mIsStartOperation = (Boolean) fIsStartOperation.get(mStartStopOperation);
        mShouldAffectListeningToAdvertisementsOnly =
            (Boolean) fShouldStartOrStopListeningToAdvertisementsOnly.get(mStartStopOperation);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("mIsStartOperation should not be null", mIsStartOperation, is(notNullValue()));
        assertThat("mIsStartOperation should be true", mIsStartOperation, is(true));
        assertThat("mIsStartOperation should not be false", mIsStartOperation, is(not(false)));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be null",
            mShouldAffectListeningToAdvertisementsOnly, is(notNullValue()));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should be false",
            mShouldAffectListeningToAdvertisementsOnly, is(false));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be true",
            mShouldAffectListeningToAdvertisementsOnly, is(not(true)));
    }

    @Test
    public void testCreateStopOperation() throws Exception {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);

        Field fCallback = mStartStopOperation.getClass().getDeclaredField("mCallback");
        Field fIsStartOperation = mStartStopOperation.getClass()
            .getDeclaredField("mIsStartOperation");
        Field fShouldStartOrStopListeningToAdvertisementsOnly = mStartStopOperation.getClass()
            .getDeclaredField("mShouldAffectListeningToAdvertisementsOnly");

        fCallback.setAccessible(true);
        fIsStartOperation.setAccessible(true);
        fShouldStartOrStopListeningToAdvertisementsOnly.setAccessible(true);

        JXcoreThaliCallback mCallback = (JXcoreThaliCallback) fCallback.get(mStartStopOperation);
        boolean mIsStartOperation = (Boolean) fIsStartOperation.get(mStartStopOperation);
        boolean mShouldAffectListeningToAdvertisementsOnly =
            (Boolean) fShouldStartOrStopListeningToAdvertisementsOnly.get(mStartStopOperation);

        assertThat("mJXcoreThaliCallback should not be null", mJXcoreThaliCallback,
            is(notNullValue()));
        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("mCallback should not be null", mCallback, is(notNullValue()));
        assertThat("mCallback shoulb be equal to mJXcoreThaliCallback", mCallback,
            is(equalTo(mJXcoreThaliCallback)));
        assertThat("mIsStartOperation should not be null", mIsStartOperation, is(notNullValue()));
        assertThat("mIsStartOperation should be false", mIsStartOperation, is(false));
        assertThat("mIsStartOperation should not be true", mIsStartOperation, is(not(true)));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be null",
            mShouldAffectListeningToAdvertisementsOnly, is(notNullValue()));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should be true",
            mShouldAffectListeningToAdvertisementsOnly, is(true));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be false",
            mShouldAffectListeningToAdvertisementsOnly, is(not(false)));

        mStartStopOperation =
            StartStopOperation.createStopOperation(false, mJXcoreThaliCallback);
        mIsStartOperation = (Boolean) fIsStartOperation.get(mStartStopOperation);
        mShouldAffectListeningToAdvertisementsOnly =
            (Boolean) fShouldStartOrStopListeningToAdvertisementsOnly.get(mStartStopOperation);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("mIsStartOperation should not be null", mIsStartOperation,
            is(notNullValue()));
        assertThat("mIsStartOperation should be false", mIsStartOperation, is(false));
        assertThat("mIsStartOperation should not be true", mIsStartOperation, is(not(true)));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be null",
            mShouldAffectListeningToAdvertisementsOnly, is(notNullValue()));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should be false",
            mShouldAffectListeningToAdvertisementsOnly, is(false));
        assertThat("mShouldAffectListeningToAdvertisementsOnly should not be true",
            mShouldAffectListeningToAdvertisementsOnly, is(not(true)));
    }

    @Test
    public void testGetCallback() throws Exception {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);

        Thread.sleep(1000);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("getCallback should be equal to mJXcoreThaliCallback",
            mStartStopOperation.getCallback(), is(equalTo(mJXcoreThaliCallback)));

        mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        mStartStopOperation =
            StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);

        Thread.sleep(1000);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("getCallback return should be equal to mJXcoreThaliCallback",
            mStartStopOperation.getCallback(), is(equalTo(mJXcoreThaliCallback)));
    }

    @Test
    public void testIsStartOperation() throws Exception {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("isStartOperation should return true",
            mStartStopOperation.isStartOperation(), is(true));

        mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        mStartStopOperation =
            StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("isStartOperation should return false",
            mStartStopOperation.isStartOperation(), is(false));
    }

    @Test
    public void testGetShouldStartOrStopListeningToAdvertisementsOnly() throws Exception {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("shouldAffectListeningToAdvertisementsOnly should return true",
            mStartStopOperation.shouldAffectListeningToAdvertisementsOnly(), is(true));

        mStartStopOperation =
            StartStopOperation.createStartOperation(false, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("shouldAffectListeningToAdvertisementsOnly should return false",
            mStartStopOperation.shouldAffectListeningToAdvertisementsOnly(), is(false));

        mStartStopOperation =
            StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("shouldAffectListeningToAdvertisementsOnly should return true",
            mStartStopOperation.shouldAffectListeningToAdvertisementsOnly(), is(true));

        mStartStopOperation =
            StartStopOperation.createStopOperation(false, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("shouldAffectListeningToAdvertisementsOnly should return false",
            mStartStopOperation.shouldAffectListeningToAdvertisementsOnly(), is(false));
    }

    @Test
    public void testGetOperationExecutedTime() throws Exception {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("getOperationExecutedTime should return 0", mStartStopOperation
                .getOperationExecutedTime(),
            is(equalTo(0L)));

        mStartStopOperation = StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("getOperationExecutedTime should return 0", mStartStopOperation
                .getOperationExecutedTime(),
            is(equalTo(0L)));
    }

    @Test
    public void testSetOperationExecutedTime() throws Exception {
        long operationTime = 3000L;
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("getOperationExecutedTime should return 0", mStartStopOperation
                .getOperationExecutedTime(),
            is(equalTo(0L)));

        mStartStopOperation.setOperationExecutedTime(operationTime);

        assertThat("getOperationExecutedTime should return 3000", mStartStopOperation
                .getOperationExecutedTime(),
            is(equalTo(operationTime)));

        mStartStopOperation = StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);

        assertThat("mStartStopOperation should not be null", mStartStopOperation,
            is(notNullValue()));
        assertThat("getOperationExecutedTime should return 0", mStartStopOperation
                .getOperationExecutedTime(),
            is(equalTo(0L)));

        mStartStopOperation.setOperationExecutedTime(operationTime);

        assertThat("getOperationExecutedTime should return 3000", mStartStopOperation
                .getOperationExecutedTime(),
            is(equalTo(operationTime)));
    }

    @Test
    public void testIsTargetState() throws Exception {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation mStartStopOperation =
            StartStopOperation.createStartOperation(false, mJXcoreThaliCallback);
        String result = mStartStopOperation
            .isTargetState(ConnectionManager.ConnectionManagerState.NOT_STARTED,
                DiscoveryManager.DiscoveryManagerState.NOT_STARTED, true, true);

        assertThat("Result should be Discovery manager not started", result,
            is(equalTo("Discovery manager not started")));

        result = mStartStopOperation
            .isTargetState(ConnectionManager.ConnectionManagerState.NOT_STARTED,
                DiscoveryManager.DiscoveryManagerState.RUNNING_BLE, false, true);

        assertThat("Result should be Connection manager not started", result,
            is(equalTo("Connection manager not started")));

        result = mStartStopOperation
            .isTargetState(ConnectionManager.ConnectionManagerState.RUNNING,
                DiscoveryManager.DiscoveryManagerState.RUNNING_BLE, true, false);

        assertThat("Result should be Is not advertising", result,
            is(equalTo("Is not advertising")));

        mStartStopOperation =
            StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);

        result = mStartStopOperation.isTargetState(ConnectionManager.ConnectionManagerState.RUNNING,
            DiscoveryManager.DiscoveryManagerState.RUNNING_BLE, false, false);

        assertThat("Result should be Is not discovering", result,
            is(equalTo("Is not discovering")));

        mStartStopOperation =
            StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);
        result = mStartStopOperation.isTargetState(ConnectionManager.ConnectionManagerState.RUNNING,
            DiscoveryManager.DiscoveryManagerState.RUNNING_BLE, true, false);

        assertThat("Result should be 'Is discovering (listening to advertisements), " +
                "but should not be'", result,
            is(equalTo("Is discovering (listening to advertisements), but should not be")));

        mStartStopOperation =
            StartStopOperation.createStopOperation(false, mJXcoreThaliCallback);
        result = mStartStopOperation.isTargetState(ConnectionManager.ConnectionManagerState.RUNNING,
            DiscoveryManager.DiscoveryManagerState.RUNNING_BLE, true, false);

        assertThat("Result should be Either the connection manager or the discovery manager is " +
            "still running", result, is(equalTo("Either the connection manager or the " +
            "discovery manager is still running")));
    }

    @Test
    public void testToString() {
        JXcoreThaliCallback mJXcoreThaliCallback = new JXcoreThaliCallbackMock();
        StartStopOperation startStopOperation =
            StartStopOperation.createStartOperation(false, mJXcoreThaliCallback);
        String result  = startStopOperation.toString();

        assertThat("Result should be Start operation: Should start/stop everything",
            result, is(equalTo("Start operation: Should start/stop everything")));

        startStopOperation = StartStopOperation.createStartOperation(true, mJXcoreThaliCallback);
        result  = startStopOperation.toString();

        assertThat("Result should be Start operation: Should affect listening to advertisements only",
            result, is(equalTo("Start operation: Should affect listening to advertisements only")));

        startStopOperation = StartStopOperation.createStopOperation(false, mJXcoreThaliCallback);
        result  = startStopOperation.toString();

        assertThat("Result should be Stop operation: Should start/stop everything",
            result, is(equalTo("Stop operation: Should start/stop everything")));

        startStopOperation = StartStopOperation.createStopOperation(true, mJXcoreThaliCallback);
        result  = startStopOperation.toString();

        assertThat("Result should be Stop operation: Should affect listening to advertisements only",
            result, is(equalTo("Stop operation: Should affect listening to advertisements only")));
    }

}
