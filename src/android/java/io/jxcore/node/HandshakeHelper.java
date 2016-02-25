/* Copyright (c) 2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.bluetooth.BluetoothSocket;
import android.os.CountDownTimer;
import android.util.Log;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import org.thaliproject.p2p.btconnectorlib.utils.BluetoothSocketIoThread;
import org.thaliproject.p2p.btconnectorlib.utils.CommonUtils;
import java.io.IOException;
import java.util.Arrays;
import java.util.Date;
import java.util.Iterator;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Manages the handshakes for validating both incoming and outgoing connections.
 */
public class HandshakeHelper implements BluetoothSocketIoThread.Listener {

    public interface Listener {
        /**
         * Called when a handshake succeeds.
         *
         * @param bluetoothSocket The Bluetooth socket.
         * @param peerProperties The properties of the peer.
         * @param isIncoming True, if the connection is incoming. False if outgoing.
         */
        void onHandshakeSucceeded(BluetoothSocket bluetoothSocket, PeerProperties peerProperties, boolean isIncoming);

        /**
         * Called when a handshake fails.
         *
         * @param bluetoothSocket The Bluetooth socket.
         * @param peerProperties The properties of the peer.
         * @param reason The reason why the handshake failed.
         */
        void onHandshakeFailed(BluetoothSocket bluetoothSocket, PeerProperties peerProperties, String reason);
    }

    private static final String TAG = HandshakeHelper.class.getName();
    private static final long HANDSHAKE_TIMEOUT_IN_MILLISECONDS = 3000;
    private static final long TIMEOUT_TIMER_INTERVAL_IN_MILLISECONDS = 1000;
    private final Listener mListener;
    private final CopyOnWriteArrayList<HandshakeConnection> mHandshakeConnections = new CopyOnWriteArrayList<HandshakeConnection>();
    private CountDownTimer mCheckForTimeoutsTimer = null;
    private boolean mIsShuttingDown = false;

    /**
     * Constructor.
     * @param listener The listener.
     */
    public HandshakeHelper(Listener listener) {
        mListener = listener;
    }

    /**
     * Must be called after shutdown or no handshake is initiated.
     */
    public void reinitiate() {
        if (mIsShuttingDown) {
            Log.d(TAG, "reinitiate");
            mIsShuttingDown = false;
        }
    }

    /**
     * Tries to initiate a handshake.
     *
     * @param bluetoothSocket The Bluetooth socket. Must be connected.
     * @param peerProperties The properties of the peer.
     * @param isIncoming True, if this is an incoming connection. False if outgoing.
     * @return True, if the handshake was successfully initiated. False otherwise.
     */
    public synchronized boolean initiateHandshake(
            BluetoothSocket bluetoothSocket, PeerProperties peerProperties, boolean isIncoming) {
        boolean success = false;

        if (!mIsShuttingDown
                && bluetoothSocket != null && bluetoothSocket.isConnected()
                && peerProperties != null) {
            BluetoothSocketIoThread bluetoothSocketIoThread = null;

            try {
                bluetoothSocketIoThread = new BluetoothSocketIoThread(bluetoothSocket, this);
            } catch (IOException e) {
                Log.e(TAG, "initiateHandshake: Failed to construct a handshake thread: " + e.getMessage(), e);
            }

            if (bluetoothSocketIoThread != null) {
                bluetoothSocketIoThread.setPeerProperties(peerProperties);
                bluetoothSocketIoThread.setExitThreadAfterRead(true);
                HandshakeConnection handshakeConnection = new HandshakeConnection(bluetoothSocketIoThread, isIncoming);

                if (mHandshakeConnections.addIfAbsent(handshakeConnection)) {
                    bluetoothSocketIoThread.start();

                    success = bluetoothSocketIoThread.write(
                        isIncoming
                                ? CommonUtils.createServerHandshakeMessage()
                                : CommonUtils.createClientHandshakeMessage(false) // TODO: Set the correct boolean value
                    );

                    if (success) {
                        handshakeConnection.handshakeAttemptStartedTime = new Date().getTime();

                        if (mCheckForTimeoutsTimer == null) {
                            constructTimeoutCheckTimer();
                        }

                        Log.i(TAG, "initiateHandshake: OK");
                    }
                } else {
                    Log.e(TAG, "initiateHandshake: Handshake with the given peer already initiated");
                }
            }
        } else {
            if (mIsShuttingDown) {
                Log.d(TAG, "initiateHandshake: Is shutting down, will not initiate");
            } else {
                Log.e(TAG, "initiateHandshake: Invalid argument(s): Bluetooth socket or peer properties is null, or the socket is not connected");
            }
        }

        return success;
    }

    /**
     * Shuts everything down and clears any pending handshake attempts.
     */
    public synchronized void shutdown() {
        if (!mIsShuttingDown) {
            Log.d(TAG, "shutdown");
            mIsShuttingDown = true;

            if (mCheckForTimeoutsTimer != null) {
                mCheckForTimeoutsTimer.cancel();
                mCheckForTimeoutsTimer = null;
            }

            for (HandshakeConnection handshakeConnection : mHandshakeConnections) {
                handshakeConnection.bluetoothSocketIoThread.close(true);
            }

            mHandshakeConnections.clear();
        }
    }

    /**
     * Called when a BluetoothSocketIoThread successfully read bytes from the socket.
     * If the read bytes match the expected handshake message, the handshake is considered successful.
     *
     * @param bytes The bytes read.
     * @param numberOfBytes The number of bytes read.
     * @param bluetoothSocketIoThread The thread who read the bytes.
     */
    @Override
    public void onBytesRead(byte[] bytes, int numberOfBytes, final BluetoothSocketIoThread bluetoothSocketIoThread) {
        Log.d(TAG, "onBytesRead: Read " + numberOfBytes + " byte(s): \""
                + bytes.toString() + "\" (thread ID: " + bluetoothSocketIoThread.getId());

        final HandshakeConnection handshakeConnection = getConnectionByBluetoothSocketIoThread(bluetoothSocketIoThread);
        mHandshakeConnections.remove(handshakeConnection);
        final boolean isValidHandshakeMessage;

        if (handshakeConnection.isIncoming) {
            isValidHandshakeMessage = Arrays.equals(CommonUtils.createClientHandshakeMessage(false), bytes); // TODO: Set the correct boolean value
        } else {
            isValidHandshakeMessage = Arrays.equals(CommonUtils.createServerHandshakeMessage(), bytes);
        }

        if (!mIsShuttingDown) {
            jxcore.activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (isValidHandshakeMessage) {
                        mListener.onHandshakeSucceeded(
                                handshakeConnection.bluetoothSocketIoThread.getSocket(),
                                handshakeConnection.bluetoothSocketIoThread.getPeerProperties(),
                                handshakeConnection.isIncoming);
                    } else {
                        mListener.onHandshakeFailed(
                                handshakeConnection.bluetoothSocketIoThread.getSocket(),
                                handshakeConnection.bluetoothSocketIoThread.getPeerProperties(),
                                "Failed to validate handshake message");
                    }
                }
            });
        } else {
           bluetoothSocketIoThread.close(true);
        }
    }

    @Override
    public void onBytesWritten(byte[] bytes, int numberOfBytes, BluetoothSocketIoThread bluetoothSocketIoThread) {
        Log.d(TAG, "onBytesWritten: Wrote " + numberOfBytes + " byte(s): \""
                + bytes.toString() + "\" (thread ID: " + bluetoothSocketIoThread.getId());
    }

    /**
     * Notifies the listener that the handshake failed.
     *
     * @param reason The reason why the socket was disconnected.
     * @param bluetoothSocketIoThread The thread that had the socket disconnected.
     */
    @Override
    public void onDisconnected(final String reason, BluetoothSocketIoThread bluetoothSocketIoThread) {
        Log.d(TAG, "onDisconnected: " + reason + " (thread ID: " + bluetoothSocketIoThread.getId());

        final HandshakeConnection handshakeConnection = getConnectionByBluetoothSocketIoThread(bluetoothSocketIoThread);
        removeFailedHandshakeConnectionAndNotifyListener(handshakeConnection, reason);
    }

    /**
     * Finds the connection associated with the given thread.
     *
     * @param bluetoothSocketIoThread The BluetoothSocketIoThread instance associated with the connection to find.
     * @return A HandshakeConnection instance or null if not found.
     */
    private HandshakeConnection getConnectionByBluetoothSocketIoThread(BluetoothSocketIoThread bluetoothSocketIoThread) {
        HandshakeConnection handshakeConnection = null;

        if (bluetoothSocketIoThread != null && bluetoothSocketIoThread.getPeerProperties() != null) {
            Iterator<HandshakeConnection> connectionIterator = mHandshakeConnections.iterator();

            while (connectionIterator.hasNext()) {
                HandshakeConnection currentHandshakeConnection = connectionIterator.next();

                if (currentHandshakeConnection.bluetoothSocketIoThread.getPeerProperties().equals(
                        bluetoothSocketIoThread.getPeerProperties())) {
                    handshakeConnection = currentHandshakeConnection;
                    break;
                }
            }
        }

        return handshakeConnection;
    }

    /**
     * Removes the given handshake connection, closes it and notifies the listener that the
     * handshake failed.
     *
     * @param handshakeConnection The HandshakeConnection instance.
     * @param reasonForFailure The reason for the failure.
     */
    private synchronized void removeFailedHandshakeConnectionAndNotifyListener(
            final HandshakeConnection handshakeConnection, final String reasonForFailure) {
        if (!mHandshakeConnections.remove(handshakeConnection) && mIsShuttingDown) {
            Log.e(TAG, "removeFailedHandshakeConnectionAndNotifyListener: Failed to remove the given connection");
        }

        if (!mIsShuttingDown) {
            jxcore.activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    mListener.onHandshakeFailed(
                            handshakeConnection.bluetoothSocketIoThread.getSocket(),
                            handshakeConnection.bluetoothSocketIoThread.getPeerProperties(),
                            reasonForFailure);
                }
            });
        }

        handshakeConnection.bluetoothSocketIoThread.close(true);
    }

    /**
     * Constructs the timer for checking handshake timeouts.
     */
    private void constructTimeoutCheckTimer() {
        if (mCheckForTimeoutsTimer != null) {
            mCheckForTimeoutsTimer.cancel();
            mCheckForTimeoutsTimer = null;
        }

        mCheckForTimeoutsTimer = new CountDownTimer(
                TIMEOUT_TIMER_INTERVAL_IN_MILLISECONDS, TIMEOUT_TIMER_INTERVAL_IN_MILLISECONDS) {
            @Override
            public void onTick(long millisUntilFinished) {
                // Not used
            }

            @Override
            public void onFinish() {
                final long currentTime = new Date().getTime();
                Iterator<HandshakeConnection> connectionIterator = mHandshakeConnections.iterator();

                while (connectionIterator.hasNext()) {
                    HandshakeConnection handshakeConnection = connectionIterator.next();

                    if (currentTime > handshakeConnection.handshakeAttemptStartedTime + HANDSHAKE_TIMEOUT_IN_MILLISECONDS) {
                        Log.d(TAG, "Handshake thread with ID "
                                + handshakeConnection.bluetoothSocketIoThread.getId() + " timed out");
                        removeFailedHandshakeConnectionAndNotifyListener(handshakeConnection, "Handshake timeout");
                    }
                }

                if (mHandshakeConnections.size() == 0) {
                    mCheckForTimeoutsTimer.cancel();
                    mCheckForTimeoutsTimer = null;
                } else {
                    this.start(); // Restart the timer
                }
            }
        };
    }

    /**
     * A utility class representing a connection for an ongoing handshake attempt.
     */
    private class HandshakeConnection {
        public final BluetoothSocketIoThread bluetoothSocketIoThread;
        public final boolean isIncoming;
        public long handshakeAttemptStartedTime = 0;

        public HandshakeConnection(BluetoothSocketIoThread bluetoothSocketIoThread, boolean isIncoming) {
            this.bluetoothSocketIoThread = bluetoothSocketIoThread;
            this.isIncoming = isIncoming;
        }

        /**
         * For addIfAbsent()
         * @param object Another HandshakeConnection instance.
         * @return True, if the peer ID contained by BluetoothSocketIoThread instance matches.
         */
        @Override
        public boolean equals(Object object) {
            if (object != null && object instanceof HandshakeConnection) {
                return ((HandshakeConnection) object).bluetoothSocketIoThread.getPeerProperties().equals(
                        bluetoothSocketIoThread.getPeerProperties());
            }

            return false;
        }
    }
}
