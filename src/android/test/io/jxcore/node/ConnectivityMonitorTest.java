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
    static String mTag = ConnectivityMonitorTest.class.getName();
    
    @Rule
    public ExpectedException thrown = ExpectedException.none();
    
    @BeforeClass
    public static void setUpBeforeClass() throws Exception {
        mConnectionHelper = new ConnectionHelper();
        
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
    }
    
    @AfterClass
    public static void tearDownAfterClass() throws Exception {
        mBluetoothAdapter.enable();
        mWifiManager.setWifiEnabled(true);
        
        mConnectionHelper.dispose();
    }
    
    public Thread enableAndCheckBTEnabled() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (!mBluetoothAdapter.isEnabled() && counter < ThaliTestRunner.counterLimit) {
                    try {
                        mBluetoothAdapter.enable();
                        Thread.sleep(ThaliTestRunner.timeoutLimit);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);
                if (counter >= ThaliTestRunner.counterLimit) Log.e(mTag, "BT is not enabled after 5s!");
            }
        });
    }
    
    public Thread disableAndCheckBTDisabled() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (mBluetoothAdapter.isEnabled() && counter < ThaliTestRunner.counterLimit) {
                    try {
                        mBluetoothAdapter.disable();
                        Thread.sleep(ThaliTestRunner.timeoutLimit);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);
                if (counter >= ThaliTestRunner.counterLimit) Log.e(mTag, "BT is not disabled after 5s!");
            }
        });
    }
    
    public Thread enableAndCheckWifiEnabled() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (!mWifiManager.isWifiEnabled() && counter < ThaliTestRunner.counterLimit) {
                    try {
                        mWifiManager.setWifiEnabled(true);
                        Thread.sleep(ThaliTestRunner.timeoutLimit);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);
                if (counter >= ThaliTestRunner.counterLimit) Log.e(mTag, "Wifi is not enabled after 5s!");
            }
        });
    }
    
    public Thread disableAndCheckWifiDisabled() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (mWifiManager.isWifiEnabled() && counter < ThaliTestRunner.counterLimit) {
                    try {
                        mWifiManager.setWifiEnabled(false);
                        Thread.sleep(ThaliTestRunner.timeoutLimit);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                mConnectivityMonitor.updateConnectivityInfo(false);
                if (counter >= ThaliTestRunner.counterLimit) Log.e(mTag, "Wifi is not disabled after 5s!");
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
        
        // WIFI
        Thread disableWifi = disableAndCheckWifiDisabled();
        
        // check the state. If the intent is registered the state should be updated;
        disableWifi.start();
        disableWifi.join();
        
        assertThat("Proper state of WIFI is set when switched off",
                   mConnectivityMonitor.isWifiEnabled(), is(mWifiManager.isWifiEnabled()));
        
        // change the WIFI state back
        Thread enableWifi = enableAndCheckWifiEnabled();
        
        enableWifi.start();
        enableWifi.join();
        
        assertThat("Proper state of WIFI is set when switched on",
                   mConnectivityMonitor.isWifiEnabled(), is(mWifiManager.isWifiEnabled()));
        
        //Bluetooth
        Thread disableBT = disableAndCheckBTDisabled();
        
        disableBT.start();
        disableBT.join();
        
        // check the state. If the intent is registered the state should be updated;
        assertThat("Proper state of BT is set when switched off",
                   mConnectivityMonitor.isBluetoothEnabled(), is(false));
        
        // change the BT state back
        Thread enableBT = enableAndCheckBTEnabled();
        
        enableBT.start();
        enableBT.join();
        
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
        Thread disableBT = disableAndCheckBTDisabled();
        
        disableBT.start();
        disableBT.join();
        
        mConnectivityMonitor.updateConnectivityInfo(false);
        
        assertThat("Returns proper state of BT when switched off",
                   mConnectivityMonitor.isBluetoothEnabled(), is(false));
        
        Thread enableBT = enableAndCheckBTEnabled();
        
        enableBT.start();
        enableBT.join();
        
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
        Thread disableWifi = disableAndCheckWifiDisabled();
        
        mWifiManager.setWifiEnabled(false);
        disableWifi.start();
        disableWifi.join();
        mConnectivityMonitor.updateConnectivityInfo(false);
        
        assertThat("Returns proper state of WIFI when switched off",
                   mConnectivityMonitor.isWifiEnabled(), is(false));
        
        Thread enableWifi = enableAndCheckWifiEnabled();
        
        mWifiManager.setWifiEnabled(true);
        enableWifi.start();
        enableWifi.join();
        mConnectivityMonitor.updateConnectivityInfo(false);
        
        assertThat("Returns proper state of WIFI when switched on",
                   mConnectivityMonitor.isWifiEnabled(), is(true));
    }
}
