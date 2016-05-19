/* Copyright (c) 2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.os.CountDownTimer;
import android.util.Log;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import org.thaliproject.p2p.btconnectorlib.utils.PeerModel;

/**
 * A helper class to test some scenarios without the Node layer or the test server.
 *
 * You can also use the native test app
 * (found here: https://github.com/thaliproject/Thali_CordovaPlugin_BtLibrary/tree/master/NativeTestApp)
 * as long as you make sure the IDs (service UUIDs) match; both SERVICE_UUID and BLE_SERVICE_UUID
 * in ConnectionHelper class should be the same (b6a44ad1-d319-4b3a-815d-8b805a47fb51 in the native
 * test app).
 *
 * Quick how-to: Create an instance of this class in the constructor of the ConnectionHelper class
 * and start the desired test scenario (see TestType enumeration of this class).
 */
public class TestHelper implements PeerModel.Listener {
    public enum TestType {
        NONE,

        /**
         * Repetitive connect and disconnect test
         *
         * Use this test to observe the robustness of outgoing connection attempts.
         *
         * Tries to connect to every found (new or updated) peer. After successfully connected to a
         * peer, all outgoing connections are killed and the peer model is cleared in order to get
         * new "peer added" event to start the cycle again.
         */
        REPETITIVE_CONNECT_AND_DISCONNECT,

        /**
         * Keep listening
         *
         * Keeps listening for and accepting incoming connections. Will not disconnect.
         */
        KEEP_LISTENING,

        /**
         * Keep listening with repetitive disconnect
         *
         * Keeps listening for incoming connections and after a successful connection attempt will
         * disconnect with a delay.
         */
        KEEP_LISTENING_WITH_REPETITIVE_DISCONNECT,
    }

    private static final String TAG = TestHelper.class.getSimpleName();
    private static final long DISCONNECT_DELAY_IN_MILLISECONDS = 3000;
    private static final long CHECK_INCOMING_CONNECTIONS_STATUS_INTERVAL_IN_MILLISECONDS = DISCONNECT_DELAY_IN_MILLISECONDS;

    private ConnectionHelper mConnectionHelper;
    private DiscoveryManager mDiscoveryManager;
    private PeerModel mPeerModel;
    private ConnectionModel mConnectionModel;
    private TestJXcoreThaliCallback mTestJXcoreThaliCallback;
    private CountDownTimer mCheckIncomingConnectionStatusTimer;
    private TestType mCurrentTestType = TestType.NONE;
    private int mTotalNumberOfConnectionsAttempts;
    private int mNumberOfSuccessfulConnectionAttempts;

    /**
     * Constructor.
     *
     * @param connectionHelper The ConnectionHelper instance.
     */
    public TestHelper(ConnectionHelper connectionHelper) {
        mConnectionHelper = connectionHelper;
        mDiscoveryManager = mConnectionHelper.getDiscoveryManager();
        mPeerModel = mDiscoveryManager.getPeerModel();
        mPeerModel.addListener(this);
        mConnectionModel = mConnectionHelper.getConnectionModel();
        mTestJXcoreThaliCallback = new TestJXcoreThaliCallback();
    }

    /**
     * Starts the specified test scenario.
     *
     * @param testTypeToStart The type of the test to start.
     */
    public void startTest(TestType testTypeToStart) {
        mTotalNumberOfConnectionsAttempts = 0;
        mNumberOfSuccessfulConnectionAttempts = 0;

        mCurrentTestType = testTypeToStart;

        switch (mCurrentTestType) {
            case NONE:
                // Do nothing
                break;
            case REPETITIVE_CONNECT_AND_DISCONNECT:
            case KEEP_LISTENING:
            case KEEP_LISTENING_WITH_REPETITIVE_DISCONNECT:
                mDiscoveryManager.start(true, true);
                mConnectionHelper.start(1337, true, mTestJXcoreThaliCallback);

                if (mCurrentTestType == TestType.KEEP_LISTENING_WITH_REPETITIVE_DISCONNECT) {
                    mCheckIncomingConnectionStatusTimer = new CountDownTimer(
                            CHECK_INCOMING_CONNECTIONS_STATUS_INTERVAL_IN_MILLISECONDS,
                            CHECK_INCOMING_CONNECTIONS_STATUS_INTERVAL_IN_MILLISECONDS) {
                        @Override
                        public void onTick(long l) {
                            // Not used
                        }

                        @Override
                        public void onFinish() {
                            mCheckIncomingConnectionStatusTimer.cancel();

                            jxcore.coreThread.handler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    final int connectionCount = mConnectionModel.getNumberOfCurrentConnections();

                                    if (connectionCount > 0) {
                                        Log.i(TAG, "Killing " + connectionCount + " connection(s)");
                                        mConnectionHelper.killConnections(true);
                                    }
                                }
                            }, DISCONNECT_DELAY_IN_MILLISECONDS);

                            mCheckIncomingConnectionStatusTimer.start();
                        }
                    }.start();
                }
                break;
            default:
                throw new IllegalStateException("Invalid test type");
        }
    }

    @Override
    public void onPeerAdded(PeerProperties peerProperties) {
        onPeerAddedOrUpdated(peerProperties);
    }

    @Override
    public void onPeerUpdated(PeerProperties peerProperties) {
        onPeerAddedOrUpdated(peerProperties);
    }

    @Override
    public void onPeerExpiredAndRemoved(PeerProperties peerProperties) {
        // No implementation
    }

    private void onPeerAddedOrUpdated(PeerProperties peerProperties) {
        switch (mCurrentTestType) {
            case NONE:
                // Do nothing
                break;
            case REPETITIVE_CONNECT_AND_DISCONNECT:
                final String bluetoothMacAddress = peerProperties.getBluetoothMacAddress();

                if (mConnectionModel.getOutgoingConnectionCallbackByBluetoothMacAddress(bluetoothMacAddress) != null) {
                    Log.i(TAG, "onPeerAddedOrUpdated: Already connecting to peer " + peerProperties);
                    return;
                }

                if (mConnectionModel.hasOutgoingConnection(peerProperties.getId())) {
                    Log.i(TAG, "onPeerAddedOrUpdated: Already connected to peer " + peerProperties);
                    return;
                }

                Log.i(TAG, "onPeerAddedOrUpdated: Connecting to peer " + peerProperties);
                String errorMessage = mConnectionHelper.connect(bluetoothMacAddress, mTestJXcoreThaliCallback);

                if (errorMessage == null) {
                    mTotalNumberOfConnectionsAttempts++;
                } else {
                    Log.e(TAG, "onPeerAddedOrUpdated: Failed to connect: " + errorMessage);
                }

                break;
            case KEEP_LISTENING:
            case KEEP_LISTENING_WITH_REPETITIVE_DISCONNECT:
                // Do nothing
                break;
            default:
                throw new IllegalStateException("Invalid test type");
        }
    }

    private void onConnectAttemptResult(final String errorMessage) {
        if (errorMessage == null) {
            Log.i(TAG, "onConnected: Successfully connected");
            mNumberOfSuccessfulConnectionAttempts++;
        } else {
            Log.e(TAG, "onConnected: " + errorMessage);
        }

        Log.i(TAG, "onConnected: Connection attempt success rate: "
                + mNumberOfSuccessfulConnectionAttempts + "/" + mTotalNumberOfConnectionsAttempts);

        switch (mCurrentTestType) {
            case NONE:
                // Do nothing
                break;
            case REPETITIVE_CONNECT_AND_DISCONNECT:
                jxcore.coreThread.handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        if (errorMessage == null) {
                            // Successfully connected
                            Log.i(TAG, "onConnected: Killing all outgoing connections");
                            mConnectionHelper.killConnections(false);
                        }

                        mPeerModel.clear(); // Clear the peer model to get new "peer added" events
                    }
                }, DISCONNECT_DELAY_IN_MILLISECONDS);

                break;
            default:
                throw new IllegalStateException("Invalid test type");
        }
    }

    /**
     * Test replacement for JXcoreThaliCallback.
     */
    private class TestJXcoreThaliCallback extends JXcoreThaliCallback {
        @Override
        public void callOnConnectCallback(
                final String errorMessage, final ListenerOrIncomingConnection listenerOrIncomingConnection) {
            onConnectAttemptResult(errorMessage);
        }

        @Override
        public void callOnStartStopCallback(final String errorMessage) {
            Log.i(TAG, "TestJXcoreThaliCallback: callOnStartStopCallback: " + errorMessage);
        }

        /**
         * If err is not NULL then listenerOrIncomingConnection MUST be null and vice
         * versa.
         *
         * @param errorMessage                 If null then the call the callback was submitted to was
         *                                     successful. If not null then it will be an Error object that will define what
         *                                     went wrong.
         * @param listenerOrIncomingConnection If null then the call the callback was
         *                                     submitted to failed. Otherwise this
         *                                     contains the success results.
         */
        @Override
        protected void onConnectCallback(
                String errorMessage, ListenerOrIncomingConnection listenerOrIncomingConnection) {
            onConnectAttemptResult(errorMessage);
        }

        /**
         * @param errorMessage If null, the operation was successful.
         */
        @Override
        protected void onStartStopCallback(String errorMessage) {
            if (errorMessage == null) {
                Log.i(TAG, "TestJXcoreThaliCallback: onStartStopCallback: Successfully started");
                mNumberOfSuccessfulConnectionAttempts++;
            } else {
                Log.e(TAG, "TestJXcoreThaliCallback: onStartStopCallback: " + errorMessage);
            }
        }
    }
}
