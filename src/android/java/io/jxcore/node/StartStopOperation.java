/* Copyright (c) 2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import org.thaliproject.p2p.btconnectorlib.ConnectionManager.ConnectionManagerState;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager.DiscoveryManagerState;

/**
 * Represents a start or a stop operation.
 */
public class StartStopOperation {
    private final JXcoreThaliCallback mCallback;
    private final boolean mIsStartOperation;
    private final boolean mShouldStartOrStopListeningOnly;
    private long mOperationExecutedTime = 0;

    /**
     * Creates a new start operation.
     *
     * @param startListeningOnly If true, will start listening for advertisements only, and will not
     *                           start the connection manager.
     *                           If false, will start the connection manager and will start advertising.
     * @param callback The callback to call when we get the operation result.
     * @return A newly created start operation.
     */
    public static StartStopOperation createStartOperation(
            boolean startListeningOnly, JXcoreThaliCallback callback) {
        return new StartStopOperation(true, startListeningOnly, callback);
    }

    /**
     * Creates a new stop operation.
     *
     * @param stopListeningOnly If true, will only stop listening for advertisements.
     *                          If false, will stop everything.
     * @param callback The callback to call when we get the operation result.
     * @return A newly created stop operation.
     */
    public static StartStopOperation createStopOperation(
            boolean stopListeningOnly, JXcoreThaliCallback callback) {
        return new StartStopOperation(false, stopListeningOnly, callback);
    }

    /**
     * Constructor.
     *
     * @param isStartOperation If true, this will be a start operation. If false, a stop operation.
     * @param startOrStopListeningOnly In case of start operation: If true should start listening
     *                                 for advertisements only. In case of stop operation: If true,
     *                                 will only stop listening for advertisements, if false, will
     *                                 stop everything.
     * @param callback The callback to call when we get the operation result.
     */
    private StartStopOperation(
            boolean isStartOperation, boolean startOrStopListeningOnly, JXcoreThaliCallback callback) {
        mCallback = callback;
        mIsStartOperation = isStartOperation;
        mShouldStartOrStopListeningOnly = startOrStopListeningOnly;
    }

    public JXcoreThaliCallback getCallback() {
        return mCallback;
    }

    public boolean isStartOperation() {
        return mIsStartOperation;
    }

    /**
     * See constructor doc.
     */
    public boolean getShouldStartOrStopListeningOnly() {
        return mShouldStartOrStopListeningOnly;
    }

    /**
     * @return The time when this operation was executed or 0 if not executed.
     */
    public long getOperationExecutedTime() {
        return mOperationExecutedTime;
    }

    /**
     * @param operationStartedTime Sets the time when this operation was executed.
     */
    public void setOperationExecutedTime(long operationStartedTime) {
        mOperationExecutedTime = operationStartedTime;
    }

    /**
     * Checks if the given states match the expected outcome of this operation after executed.
     *
     * @param connectionManagerState The connection manager state.
     * @param discoveryManagerState The discovery manager state.
     * @param isDiscovering True, if is discovering. False otherwise.
     * @param isAdvertising True, if is advertising. False otherwise.
     * @return Null, if the given states match the expected outcome of this operation.
     * A string containing an error message otherwise (useful for debugging possible errors).
     */
    public String isTargetState(
            ConnectionManagerState connectionManagerState, DiscoveryManagerState discoveryManagerState,
            boolean isDiscovering, boolean isAdvertising) {
        if (mIsStartOperation) {
            // Discovery manager should always be running and we should be listening for advertisements
            if (discoveryManagerState == DiscoveryManagerState.NOT_STARTED) {
                return "Discovery manager not started";
            }

            if (!isDiscovering) {
                return "Is not discovering";
            }

            if (mShouldStartOrStopListeningOnly) {
                // Connection manager should not be running and we shouldn't be advertising
                if (connectionManagerState != ConnectionManagerState.NOT_STARTED) {
                    return "Connection manager running, but should not be";
                }

                if (isAdvertising) {
                    return "Is advertising, but should not be";
                }
            } else {
                // Connection manager should be running and we should be advertising
                if (connectionManagerState == ConnectionManagerState.NOT_STARTED) {
                    return "Connection manager not started";
                }

                if (!isAdvertising) {
                    return "Is not advertising";
                }
            }
        } else {
            // Is stop operation
            if (mShouldStartOrStopListeningOnly) {
                // Listening to advertisements should be stopped
                if (isDiscovering) {
                    return "Is discovering (listening to advertisements), but should not be";
                }
            } else {
                // Everything should be stopped
                if (connectionManagerState != ConnectionManagerState.NOT_STARTED
                        || discoveryManagerState != DiscoveryManagerState.NOT_STARTED) {
                    return "Either the connection manager or the discovery manager is still running";
                }
            }
        }

        return null;
    }
}
