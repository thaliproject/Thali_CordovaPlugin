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
    private final boolean mShouldStartAdvertisingOrStopListening;
    private long mOperationExecutedTime = 0;

    /**
     * Creates a new start operation.
     *
     * @param startAdvertising If true, will start advertising. If false, will only start listening
     *                         for advertisements.
     * @param callback The callback to call when we get the operation result.
     * @return A newly created start operation.
     */
    public static StartStopOperation createStartOperation(
            boolean startAdvertising, JXcoreThaliCallback callback) {
        return new StartStopOperation(true, startAdvertising, callback);
    }

    /**
     * Creates a new stop operation.
     *
     * @param stopOnlyListeningForAdvertisements If true, will only stop listening for advertisements.
     *                                           If false, will stop everything.
     * @param callback The callback to call when we get the operation result.
     * @return A newly created stop operation.
     */
    public static StartStopOperation createStopOperation(
            boolean stopOnlyListeningForAdvertisements, JXcoreThaliCallback callback) {
        return new StartStopOperation(false, stopOnlyListeningForAdvertisements, callback);
    }

    /**
     * Constructor.
     *
     * @param isStartOperation If true, this will be a start operation. If false, a stop operation.
     * @param startAdvertisingOrStopListening In case of start operation: If true should start
     *                                        advertising. In case of stop operation: If true,
     *                                        will only stop listening for advertisements, if false,
     *                                        will stop everything.
     * @param callback The callback to call when we get the operation result.
     */
    private StartStopOperation(
            boolean isStartOperation, boolean startAdvertisingOrStopListening, JXcoreThaliCallback callback) {
        mCallback = callback;
        mIsStartOperation = isStartOperation;
        mShouldStartAdvertisingOrStopListening = startAdvertisingOrStopListening;
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
    public boolean getShouldStartAdvertisingOrStopListening() {
        return mShouldStartAdvertisingOrStopListening;
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
            if (connectionManagerState == ConnectionManagerState.NOT_STARTED
                    || discoveryManagerState == DiscoveryManagerState.NOT_STARTED) {
                return "Either the connection manager or the discovery manager not started";
            }

            if (!isDiscovering) {
                return "Is not discovering";
            }

            if (mShouldStartAdvertisingOrStopListening && !isAdvertising) {
                return "Should be advertising, but is not";
            }
        } else {
            // Is stop operation
            if (mShouldStartAdvertisingOrStopListening) {
                // Listening to advertisements should be stopped
                if (isDiscovering) {
                    return "Should NOT be discovering (listening to advertisements)";
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
