package io.jxcore.node;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.net.wifi.WifiManager;

import org.junit.After;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothManager;
import org.thaliproject.p2p.btconnectorlib.internal.wifi.WifiDirectManager;

import java.lang.reflect.Field;
import java.util.concurrent.CopyOnWriteArrayList;

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

    @Rule
    public ExpectedException thrown = ExpectedException.none();

    @BeforeClass
    public static void setUpBeforeClass() throws Exception {
        mBluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        mContext = jxcore.activity.getBaseContext();

        mWifiManager = (WifiManager) mContext.getSystemService(Context.WIFI_SERVICE);

        currentWifiState = mWifiManager.isWifiEnabled();
        currentBTState = mBluetoothAdapter.isEnabled();
    }

    @Before
    public void setUp() throws Exception {
        mConnectionHelper = new ConnectionHelper();
        mConnectivityMonitor = mConnectionHelper.getConnectivityMonitor();

        Field bluetoothManagerField = mConnectivityMonitor.getClass()
                .getDeclaredField("mBluetoothManager");
        bluetoothManagerField.setAccessible(true);
        mBluetoothManager = (BluetoothManager) bluetoothManagerField.get(mConnectivityMonitor);

        Field wifiDirectManagerField = mConnectivityMonitor.getClass()
                .getDeclaredField("mWifiDirectManager");
        wifiDirectManagerField.setAccessible(true);
        mWifiDirectManager = (WifiDirectManager) wifiDirectManagerField.get(mConnectivityMonitor);
    }

    @After
    public void tearDown() throws Exception {
        mConnectionHelper.dispose();
    }

    public Thread bluetoothStateCheckThread() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (mBluetoothAdapter.isEnabled() != currentBTState && counter < 10)
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
            }
        });
    }

    public Thread wifiStateCheckThread() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                do {
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                } while (mWifiManager.isWifiEnabled() != currentWifiState && counter < 10);
            }
        });
    }

    @Test
    public void testStartStop() throws Exception {
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

        Thread wifiStateCheck2 = wifiStateCheckThread();
        Thread wifiStateCheck3 = wifiStateCheckThread();

        // WIFI
        currentWifiState = !currentWifiState;
        mWifiManager.setWifiEnabled(currentWifiState);

        // check the state. If the intent is registered the state should be updated;
        wifiStateCheck2.start();
        wifiStateCheck2.join();

        assertThat("Proper state of WIFI is set when switched off",
                mConnectivityMonitor.isWifiEnabled(), is(mWifiManager.isWifiEnabled()));

        // change the WIFI state back
        currentWifiState = !currentWifiState;
        mWifiManager.setWifiEnabled(currentWifiState);

        wifiStateCheck3.start();
        wifiStateCheck3.join();

        assertThat("Proper state of WIFI is set when switched on",
                mConnectivityMonitor.isWifiEnabled(), is(mWifiManager.isWifiEnabled()));

        Thread btStateCheck2 = bluetoothStateCheckThread();
        Thread btStateCheck3 = bluetoothStateCheckThread();

        //Bluetooth
        currentBTState = !currentBTState;

        if (currentBTState) {
            mBluetoothAdapter.disable();
        } else {
            mBluetoothAdapter.enable();
        }

        btStateCheck2.start();
        btStateCheck2.join();

        // check the state. If the intent is registered the state should be updated;
        assertThat("Proper state of BT is set when switched on",
                mConnectivityMonitor.isBluetoothEnabled(), is(mBluetoothAdapter.isEnabled()));

        // change the BT state back
        currentBTState = !currentBTState;

        if (currentBTState) {
            mBluetoothAdapter.disable();
        } else {
            mBluetoothAdapter.enable();
        }

        btStateCheck3.start();
        btStateCheck3.join();

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
        Thread checkEnabled = new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                do {
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                } while (!mBluetoothAdapter.isEnabled() && counter < 10);
            }
        });

        Thread checkDisabled = new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                do {
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                } while (mBluetoothAdapter.isEnabled() && counter < 10);
            }
        });

        mBluetoothAdapter.disable();
        checkDisabled.start();
        checkDisabled.join();
        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Returns proper state of BT when switched off",
                mConnectivityMonitor.isBluetoothEnabled(), is(false));

        mBluetoothAdapter.enable();
        checkEnabled.start();
        checkEnabled.join();
        mConnectivityMonitor.updateConnectivityInfo(false);

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

        Thread checkEnabled = new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                do {
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                } while (!mWifiManager.isWifiEnabled() && counter < 10);
            }
        });

        Thread checkDisabled = new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                do {
                    try {
                        Thread.sleep(500);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                } while (mWifiManager.isWifiEnabled() && counter < 10);
            }
        });

        mWifiManager.setWifiEnabled(false);
        checkDisabled.start();
        checkDisabled.join();
        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Returns proper state of WIFI when switched off",
                mConnectivityMonitor.isWifiEnabled(), is(false));

        mWifiManager.setWifiEnabled(true);
        checkEnabled.start();
        checkEnabled.join();
        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Returns proper state of WIFI when switched on",
                mConnectivityMonitor.isWifiEnabled(), is(true));
    }
}
