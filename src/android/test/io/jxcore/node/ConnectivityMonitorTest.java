package io.jxcore.node;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.junit.rules.TestRule;
import org.junit.rules.TestWatcher;
import org.junit.runner.Description;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothManager;
import org.thaliproject.p2p.btconnectorlib.internal.wifi.WifiDirectManager;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.lang.reflect.Field;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.MatcherAssert.assertThat;

public class ConnectivityMonitorTest {
    static ConnectivityMonitor mConnectivityMonitor;
    static BluetoothManager mBluetoothManager;
    static WifiDirectManager mWifiDirectManager;
    static Context mContext;
    static boolean currentWifiState;
    static boolean currentBTState;

    static BluetoothAdapter mBluetoothAdapter;
    static WifiManager mWifiManager;
    static ConnectionHelper mConnectionHelper;
    final static String mTag = ConnectivityMonitorTest.class.getName();
    static ExecutorService mExecutor;

    @Rule
    public ExpectedException thrown = ExpectedException.none();

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

        mBluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        mContext = jxcore.activity.getBaseContext();

        mWifiManager = (WifiManager) mContext.getSystemService(Context.WIFI_SERVICE);

        currentWifiState = mWifiManager.isWifiEnabled();
        currentBTState = mBluetoothAdapter.isEnabled();

        mConnectivityMonitor = mConnectionHelper.getConnectivityMonitor();
        Field bluetoothManagerField = mConnectivityMonitor.getClass()
            .getDeclaredField("mBluetoothManager");
        bluetoothManagerField.setAccessible(true);
        mBluetoothManager = (BluetoothManager) bluetoothManagerField.get(mConnectivityMonitor);

        Field wifiDirectManagerField = mConnectivityMonitor.getClass()
            .getDeclaredField("mWifiDirectManager");
        wifiDirectManagerField.setAccessible(true);
        mWifiDirectManager = (WifiDirectManager) wifiDirectManagerField.get(mConnectivityMonitor);

        mBluetoothAdapter.enable();
        mWifiManager.setWifiEnabled(true);

        mExecutor = Executors.newSingleThreadExecutor();
    }

    @AfterClass
    public static void tearDownAfterClass() throws Exception {
        mBluetoothAdapter.enable();
        mWifiManager.setWifiEnabled(true);

        mConnectionHelper.dispose();
    }

    public Callable<Boolean> enableAndCheckBTEnabled() {
        return new Callable<Boolean>() {
            int counter = 0;
            @Override
            public Boolean call() {
                while (!mBluetoothAdapter.isEnabled() && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        mBluetoothAdapter.enable();
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);

                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(mTag, "BT is not enabled after 5s!");
                    return false;
                }
            }
        };
    }

    public Callable<Boolean> disableAndCheckBTDisabled() {
        return new Callable<Boolean>() {
            int counter = 0;
            @Override
            public Boolean call() {
                while (mBluetoothAdapter.isEnabled() && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        mBluetoothAdapter.disable();
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(mTag, "BT is not disabled after 5s!");
                    return false;
                }
            }
        };
    }

    public Callable<Boolean> enableAndCheckWifiEnabled() {
        return new Callable<Boolean>() {
            int counter = 0;
            @Override
            public Boolean call() {
                while (!mWifiManager.isWifiEnabled() && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        mWifiManager.setWifiEnabled(true);
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(mTag, "Wifi is not enabled after 5s!");
                    return false;
                }
            }
        };
    }

    public Callable<Boolean> disableAndCheckWifiDisabled() {
        return new Callable<Boolean>() {
            int counter = 0;
            @Override
            public Boolean call() {
                while (mWifiManager.isWifiEnabled() && counter < ThaliTestRunner.COUNTER_LIMIT) {
                    try {
                        mWifiManager.setWifiEnabled(false);
                        Thread.sleep(ThaliTestRunner.TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);
                if (counter < ThaliTestRunner.COUNTER_LIMIT) {
                    return true;
                } else {
                    Log.e(mTag, "Wifi is not disabled after 5s!");
                    return false;
                }
            }
        };
    }


    @Ignore("https://github.com/thaliproject/Thali_CordovaPlugin/issues/1529")
    @Test
    public void testStartStop() throws Exception {
        Future<Boolean> mFuture;

        Field mListenersField = mBluetoothManager.getClass().getDeclaredField("mListeners");
        mListenersField.setAccessible(true);

        // Since ConnectivityMonitor was already started during initialization of ConnectionHelper,
        // we only check if proper states of WiFi and BT were set.
        assertThat("Proper state of WIFI is set during the start",
            mConnectivityMonitor.isWifiEnabled(), is(mWifiManager.isWifiEnabled()));

        assertThat("Proper state of BT is set when during the start",
            mConnectivityMonitor.isBluetoothEnabled(), is(mBluetoothAdapter.isEnabled()));

        assertThat("The BT listener was bound",
            ((CopyOnWriteArrayList) mListenersField.get(mBluetoothManager)).size() > 0,
            is(true));

        // WIFI
        mFuture = mExecutor.submit(disableAndCheckWifiDisabled());

        // check the state. If the intent is registered the state should be updated;
        assertThat("Wifi should be disabled", mFuture.get(), is(true));
        assertThat("Proper state of WIFI is set when switched off",
            mConnectivityMonitor.isWifiEnabled(), is(mWifiManager.isWifiEnabled()));

        // change the WIFI state back
        mFuture = mExecutor.submit(enableAndCheckWifiEnabled());

        assertThat("Wifi should be enabled", mFuture.get(), is(true));
        assertThat("Proper state of WIFI is set when switched on",
            mConnectivityMonitor.isWifiEnabled(), is(mWifiManager.isWifiEnabled()));

        //Bluetooth
        mFuture = mExecutor.submit(disableAndCheckBTDisabled());

        // check the state. If the intent is registered the state should be updated;
        assertThat("BT should be disabled", mFuture.get(), is(true));
        assertThat("Proper state of BT is set when switched off",
            mConnectivityMonitor.isBluetoothEnabled(), is(false));

        // change the BT state back
        mFuture = mExecutor.submit(enableAndCheckBTEnabled());

        assertThat("BT should be enabled", mFuture.get(), is(true));
        assertThat("Proper state of BT is set when switched on",
            mConnectivityMonitor.isBluetoothEnabled(), is(mBluetoothAdapter.isEnabled()));

        int sizeBeforeBTlistenerRelease = ((CopyOnWriteArrayList) mListenersField.get(mBluetoothManager)).size();

        mConnectivityMonitor.stop();

        assertThat("The BT listener is released",
            ((CopyOnWriteArrayList) mListenersField.get(mBluetoothManager)).size(),
            is(equalTo(sizeBeforeBTlistenerRelease - 1)));

        Field fWifiStateChangedAndConnectivityActionBroadcastReceiver = mConnectivityMonitor.getClass()
            .getDeclaredField("mWifiStateChangedAndConnectivityActionBroadcastReceiver");
        fWifiStateChangedAndConnectivityActionBroadcastReceiver.setAccessible(true);
        BroadcastReceiver mWifiStateChangedAndConnectivityActionBroadcastReceiver =
            (BroadcastReceiver) fWifiStateChangedAndConnectivityActionBroadcastReceiver
                .get(mConnectivityMonitor);

        Activity mActivity = jxcore.activity;

        thrown.expect(IllegalArgumentException.class);
        mActivity.unregisterReceiver(mWifiStateChangedAndConnectivityActionBroadcastReceiver);
        // throws IllegalArgumentException if mWifiStateChangedAndConnectivityActionBroadcastReceiver
        // was properly unregistered
    }

    @Test
    public void testIsBluetoothSupported() throws Exception {
        if (mBluetoothAdapter != null) {
            assertThat("Returns true as the device has the Bluetooth support",
                mConnectivityMonitor.isBluetoothSupported(), is(true));
        } else {
            assertThat("Returns true as the device has the Bluetooth support",
                mConnectivityMonitor.isBluetoothSupported(), is(false));
        }
    }

    @Test
    public void testIsBleMultipleAdvertisementSupported() throws Exception {
        assertThat("Returns the proper value of BleMultipleAdvertisementSupport",
            mConnectivityMonitor.isBleMultipleAdvertisementSupported(),
            is(notNullValue()));
    }

    @Test
    public void testIsBluetoothEnabled() throws Exception {
        Future<Boolean> mFuture = mExecutor.submit(disableAndCheckBTDisabled());
        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("BT should be disabled", mFuture.get(), is(true));
        assertThat("Returns proper state of BT when switched off",
            mConnectivityMonitor.isBluetoothEnabled(), is(false));

        mFuture = mExecutor.submit(enableAndCheckBTEnabled());

        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("BT should be enabled", mFuture.get(), is(true));
        assertThat("Returns proper state of BT when switched on",
            mConnectivityMonitor.isBluetoothEnabled(), is(true));
    }

    @Test
    public void testIsWifiDirectSupported() throws Exception {
        boolean supported = mContext.getSystemService(Context.WIFI_P2P_SERVICE) != null;

        assertThat("Returns proper value of WIFI Direct support",
            mConnectivityMonitor.isWifiDirectSupported(), is(supported));
    }

    @Test
    public void testIsWifiEnabled() throws Exception {
        Future<Boolean> mFuture = mExecutor.submit(disableAndCheckWifiDisabled());

        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Wifi should be disabled", mFuture.get(), is(true));
        assertThat("Returns proper state of WIFI when switched off",
            mConnectivityMonitor.isWifiEnabled(), is(false));

        mFuture = mExecutor.submit(enableAndCheckWifiEnabled());

        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Wifi should be enabled", mFuture.get(), is(true));
        assertThat("Returns proper state of WIFI when switched on",
            mConnectivityMonitor.isWifiEnabled(), is(true));
    }
}
