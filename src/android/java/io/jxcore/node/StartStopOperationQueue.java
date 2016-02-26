/* Copyright (c) 2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.os.CountDownTimer;
import android.util.Log;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import java.util.Date;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * A queue for the asynchronous start and stop calls.
 */
public class StartStopOperationQueue {
    private static final String TAG = StartStopOperationQueue.class.getName();
    private static final long OPERATION_TIMEOUT_IN_MILLISECONDS = 3000;
    private final ConnectionManager mConnectionManager;
    private final DiscoveryManager mDiscoveryManager;
    private final CopyOnWriteArrayList<StartStopOperation> mOperations = new CopyOnWriteArrayList<StartStopOperation>();
    private CountDownTimer mOperationTimeoutTimer = null;
    private StartStopOperation mCurrentOperation = null;

    /**
     * Constructor.
     *
     * @param connectionManager The connection manager.
     * @param discoveryManager The discovery manager.
     */
    public StartStopOperationQueue(ConnectionManager connectionManager, DiscoveryManager discoveryManager) {
        mConnectionManager = connectionManager;
        mDiscoveryManager = discoveryManager;
    }

    /**
     * Clears the operation queue.
     * Note that if there is an operation pending, its callback will not be called.
     */
    public void clearQueue() {
        if (mOperationTimeoutTimer != null) {
            mOperationTimeoutTimer.cancel();
            mOperationTimeoutTimer = null;
        }

        mOperations.clear();
        mCurrentOperation = null;
    }

    /**
     * Adds a new start operation. If the queue is empty it will be executed right away. Otherwise,
     * it will be added to the end of the queue.
     *
     * @param startAdvertising If true, will start advertising. If false, will only start listening
     *                         for advertisements.
     * @param callback The callback to call when we get the operation result.
     */
    public synchronized void addStartOperation(boolean startAdvertising, JXcoreThaliCallback callback) {
        mOperations.add(StartStopOperation.createStartOperation(startAdvertising, callback));
        executeNextOperation();
    }

    /**
     * Adds a new stop operation. If the queue is empty it will be executed right away. Otherwise,
     * it will be added to the end of the queue.
     *
     * @param stopOnlyListeningForAdvertisements If true, will only stop listening for advertisements.
     *                                           If false, will stop everything.
     * @param callback The callback to call when we get the operation result.
     */
    public synchronized void addStopOperation(
            boolean stopOnlyListeningForAdvertisements, JXcoreThaliCallback callback) {
        mOperations.add(StartStopOperation.createStopOperation(stopOnlyListeningForAdvertisements, callback));
        executeNextOperation();
    }

    /**
     * Checks if the current operation is successful (the current state matches the expected
     * outcome) and if so, executes the next operation if one exists.
     */
    public synchronized void checkCurrentOperationAndExecuteNextIfSuccessful() {
        if (mCurrentOperation != null && isTargetState(mCurrentOperation) == null) {
            Log.d(TAG, "checkCurrentOperationAndExecuteNextIfSuccessful: Operation successfully executed");

            if (mOperationTimeoutTimer != null) {
                mOperationTimeoutTimer.cancel();
                mOperationTimeoutTimer = null;
            }

            mCurrentOperation.getCallback().callOnStartStopCallback(null);
            mCurrentOperation = null;
            executeNextOperation();
        }
    }

    /**
     * Executes the next operation given that we have no operation execution pending and we have
     * operations in the queue to execute.
     */
    private synchronized void executeNextOperation() {
        if (mCurrentOperation != null || mOperations.isEmpty()) {
            // Previous operation is still pending or we have no operations execute
            return;
        }

        try {
            mCurrentOperation = mOperations.get(0);
        } catch (IndexOutOfBoundsException e) {
            Log.e(TAG, "executeNextOperation: Failed to get the next operation from the queue: " + e.getMessage(), e);
            return;
        }

        mOperations.remove(mCurrentOperation);

        if (isTargetState(mCurrentOperation) == null) {
            // The current state already matches the desired outcome of this operation so it is
            // pointless to execute this
            Log.v(TAG, "executeNextOperation: The current state already matches the desired outcome of this operation, skipping...");
            mCurrentOperation.getCallback().callOnStartStopCallback(null);
            mCurrentOperation = null;
        } else {
            if (mCurrentOperation.isStartOperation()) {
                if (!mConnectionManager.start()) {
                    final String errorMessage = "Failed to start the connection manager";
                    Log.e(TAG, "executeNextOperation: " + errorMessage);
                    mCurrentOperation.getCallback().callOnStartStopCallback(errorMessage);
                    mCurrentOperation = null;
                } else {
                    // Starting of the connection manager initiated successfully (or was already running)
                    // Discovery is always started, advertising depends on the operation parameter
                    if (!mDiscoveryManager.start(
                            true, mCurrentOperation.getShouldStartAdvertisingOrStopListening())) {
                        final String errorMessage = "Failed to start the discovery manager";
                        Log.e(TAG, "executeNextOperation: " + errorMessage);
                        mCurrentOperation.getCallback().callOnStartStopCallback(errorMessage);
                        mCurrentOperation = null;
                    }
                }
            } else {
                // Is stop operation
                if (mCurrentOperation.getShouldStartAdvertisingOrStopListening()) {
                    // Should only stop listening for advertisements
                    mDiscoveryManager.stopDiscovery();
                } else {
                    // Should stop everything
                    mConnectionManager.stop();
                    mDiscoveryManager.stop();
                }
            }
        }

        if (mCurrentOperation != null) {
            mCurrentOperation.setOperationExecutedTime(new Date().getTime());

            if (mOperationTimeoutTimer != null) {
                mOperationTimeoutTimer.cancel();
                mOperationTimeoutTimer = null;
            }

            mOperationTimeoutTimer = new CountDownTimer(
                    OPERATION_TIMEOUT_IN_MILLISECONDS, OPERATION_TIMEOUT_IN_MILLISECONDS) {
                @Override
                public void onTick(long l) {
                    // Not used
                }

                @Override
                public void onFinish() {
                    if (mCurrentOperation != null) {
                        String errorMessage = "Operation timeout, state error: " + isTargetState(mCurrentOperation);
                        Log.d(TAG, errorMessage);
                        mCurrentOperation.getCallback().onStartStopCallback(errorMessage);
                        mCurrentOperation = null;
                        mOperationTimeoutTimer = null;
                        executeNextOperation();
                    }
                }
            };

            mOperationTimeoutTimer.start();
        } else {
            executeNextOperation();
        }
    }

    /**
     * Checks if the current states match the expected outcome of the given operation after executed.
     *
     * @param startStopOperation The operation.
     * @return True, if the current states match the expected outcome of the given operation.
     */
    private String isTargetState(StartStopOperation startStopOperation) {
        return startStopOperation.isTargetState(
                mConnectionManager.getState(),
                mDiscoveryManager.getState(),
                mDiscoveryManager.isDiscovering(),
                mDiscoveryManager.isAdvertising());
    }
}
