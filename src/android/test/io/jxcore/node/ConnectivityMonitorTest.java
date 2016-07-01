package io.jxcore.node;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.BroadcastReceiver;
import android.content.Context;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothManager;
import org.thaliproject.p2p.btconnectorlib.internal.wifi.WifiDirectManager;

import java.lang.reflect.Field;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.MatcherAssert.assertThat;

public class ConnectivityMonitorTest {


    DiscoveryManagerListenerMock mDiscoveryManagerListenerMock;
    DiscoveryManagerMock mDiscoveryManagerMock;
    ConnectivityMonitor mConnectivityMonitor;
    BluetoothManager mBluetoothManager;
    WifiDirectManager mWifiDirectManager;
    Context mContext;

    @Before
    public void setUp() throws Exception {
        mDiscoveryManagerListenerMock = new DiscoveryManagerListenerMock();
        mContext = jxcore.activity.getBaseContext();
        mDiscoveryManagerMock = new DiscoveryManagerMock(mContext, mDiscoveryManagerListenerMock,
                new UUID(1, 1), "");
        mConnectivityMonitor = new ConnectivityMonitor(mDiscoveryManagerMock);

        Field bluetoothManagerField = mDiscoveryManagerMock.getClass().getSuperclass()
                .getSuperclass().getDeclaredField("mBluetoothManager");
        bluetoothManagerField.setAccessible(true);
        mBluetoothManager = (BluetoothManager) bluetoothManagerField.get(mDiscoveryManagerMock);

        Field wifiDirectManagerField = mDiscoveryManagerMock.getClass()
                .getSuperclass().getDeclaredField("mWifiDirectManager");
        wifiDirectManagerField.setAccessible(true);
        mWifiDirectManager = (WifiDirectManager) wifiDirectManagerField.get(mDiscoveryManagerMock);

    }

    @After
    public void tearDown() throws Exception {
        mConnectivityMonitor.stop();
        mDiscoveryManagerMock.dispose();
    }

    @Test(expected = IllegalArgumentException.class)
    public void testStartStop() throws Exception {
        boolean currentWifiState = mWifiDirectManager.isWifiEnabled();
        boolean currentBTState = mBluetoothManager.isBluetoothEnabled();

        currentWifiState = !currentWifiState;
        currentBTState = !currentBTState;

        Field mListenersField = mBluetoothManager.getClass().getDeclaredField("mListeners");
        mListenersField.setAccessible(true);

        // Set opposite states
        mWifiDirectManager.setWifiEnabled(currentWifiState);
        mBluetoothManager.setBluetoothEnabled(currentBTState);

        int btManagersize = ((CopyOnWriteArrayList) mListenersField.get(mBluetoothManager)).size();

        // Start monitoring connectivity, Wi-Fi and Bluetooth state changes.
        mConnectivityMonitor.start();

        Thread.sleep(1000);

        assertThat("Proper state of WIFI is set during the start",
                mConnectivityMonitor.isWifiEnabled(), is(mWifiDirectManager.isWifiEnabled()));

        assertThat("Proper state of BT is set when during the start",
                mConnectivityMonitor.isBluetoothEnabled(), is(mBluetoothManager.isBluetoothEnabled()));

        assertThat("The BT listener is binded",
                ((CopyOnWriteArrayList) mListenersField.get(mBluetoothManager)).size() > btManagersize,
                is(true));

        // WIFI
        currentWifiState = !currentWifiState;
        mWifiDirectManager.setWifiEnabled(currentWifiState);
        // check the state. If the intent is registered the state should be updated;
        Thread.sleep(1000);

        assertThat("Proper state of WIFI is set when switched off",
                mConnectivityMonitor.isWifiEnabled(), is(mWifiDirectManager.isWifiEnabled()));

        // change the WIFI state back
        currentWifiState = !currentWifiState;
        mWifiDirectManager.setWifiEnabled(currentWifiState);

        Thread.sleep(1000);
        assertThat("Proper state of WIFI is set when switched on",
                mConnectivityMonitor.isWifiEnabled(), is(mWifiDirectManager.isWifiEnabled()));

        //Bluetooth
        currentBTState = !currentBTState;
        mBluetoothManager.setBluetoothEnabled(currentBTState);
        // check the state. If the intent is registered the state should be updated;
        Thread.sleep(1000);

        assertThat("Proper state of BT is set when switched on",
                mConnectivityMonitor.isBluetoothEnabled(), is(mBluetoothManager.isBluetoothEnabled()));

        // change the BT state back
        currentBTState = !currentBTState;
        mBluetoothManager.setBluetoothEnabled(currentBTState);

        Thread.sleep(1000);
        assertThat("Proper state of BT is set when switched on",
                mConnectivityMonitor.isBluetoothEnabled(), is(mBluetoothManager.isBluetoothEnabled()));

        Field fWifiStateChangedAndConnectivityActionBroadcastReceiver = mConnectivityMonitor.getClass()
                .getDeclaredField("mWifiStateChangedAndConnectivityActionBroadcastReceiver");
        fWifiStateChangedAndConnectivityActionBroadcastReceiver.setAccessible(true);
        BroadcastReceiver mWifiStateChangedAndConnectivityActionBroadcastReceiver =
                (BroadcastReceiver) fWifiStateChangedAndConnectivityActionBroadcastReceiver.get(mConnectivityMonitor);

        mConnectivityMonitor.stop();

        Thread.sleep(1000);
        assertThat("The BT listener is released",
                ((CopyOnWriteArrayList) mListenersField.get(mBluetoothManager)).size(),
                is(1));

        Activity mActivity = jxcore.activity;
        mActivity.unregisterReceiver(mWifiStateChangedAndConnectivityActionBroadcastReceiver);
    }

    @Test
    public void testIsBluetoothSupported() throws Exception {

        Field btAdapterField = mBluetoothManager.getClass().getDeclaredField("mBluetoothAdapter");
        btAdapterField.setAccessible(true);
        BluetoothAdapter bta = (BluetoothAdapter) btAdapterField.get(mBluetoothManager);

        btAdapterField.set(mBluetoothManager, null);

        assertThat("Returns true as the device has the Bluetooth support",
                mConnectivityMonitor.isBluetoothSupported(), is(false));

        btAdapterField.set(mBluetoothManager, bta);

        assertThat("Returns false as the device does not suppot the Bluetooth,",
                mConnectivityMonitor.isBluetoothSupported(), is(true));

    }

    @Test
    public void testIsBleMultipleAdvertisementSupported() throws Exception {
        assertThat("Returns the proper value of BleMultipleAdvertisemenTupport",
                mConnectivityMonitor.isBleMultipleAdvertisementSupported(),
                is(mBluetoothManager.isBleMultipleAdvertisementSupported()));
    }

    @Test
    public void testIsBluetoothEnabled() throws Exception {
        mConnectivityMonitor.isBluetoothEnabled();

        Thread checkEnabled = new Thread(new Runnable() {
            @Override
            public void run() {
                while (!mBluetoothManager.isBluetoothEnabled()) {
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }

            }
        });

        Thread checkDisabled = new Thread(new Runnable() {
            @Override
            public void run() {
                while (mBluetoothManager.isBluetoothEnabled()) {
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
            }
        });

        mBluetoothManager.setBluetoothEnabled(false);
        checkDisabled.start();
        checkDisabled.join();

        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Returns proper state of BT when switched off",
                mConnectivityMonitor.isBluetoothEnabled(), is(false));

        mBluetoothManager.setBluetoothEnabled(true);

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
            @Override
            public void run() {
                while (!mWifiDirectManager.isWifiEnabled()) {
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }

            }
        });

        Thread checkDisabled = new Thread(new Runnable() {
            @Override
            public void run() {
                while (mWifiDirectManager.isWifiEnabled()) {
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
            }
        });

        mWifiDirectManager.setWifiEnabled(false);
        checkDisabled.start();
        checkDisabled.join();

        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Returns proper state of WIFI when switched off",
                mConnectivityMonitor.isWifiEnabled(), is(false));

        mWifiDirectManager.setWifiEnabled(true);

        checkEnabled.start();
        checkEnabled.join();
        mConnectivityMonitor.updateConnectivityInfo(false);

        assertThat("Returns proper state of WIFI when switched on",
                mConnectivityMonitor.isWifiEnabled(), is(true));

    }
    
    public class DiscoveryManagerListenerMock implements DiscoveryManager.DiscoveryManagerListener {

        @Override
        public boolean onPermissionCheckRequired(String s) {
            return false;
        }

        @Override
        public void onDiscoveryManagerStateChanged(
                DiscoveryManager.DiscoveryManagerState discoveryManagerState, boolean b, boolean b1) {

        }

        @Override
        public void onPeerDiscovered(PeerProperties peerProperties) {

        }

        @Override
        public void onPeerUpdated(PeerProperties peerProperties) {

        }

        @Override
        public void onPeerLost(PeerProperties peerProperties) {

        }

        @Override
        public void onProvideBluetoothMacAddressRequest(String s) {

        }

        @Override
        public void onPeerReadyToProvideBluetoothMacAddress() {

        }

        @Override
        public void onBluetoothMacAddressResolved(String s) {

        }
    }

    public class DiscoveryManagerMock extends DiscoveryManager {

        boolean mockmBleMultipleAdvertisementSupported;

        public DiscoveryManagerMock(Context context, DiscoveryManagerListener listener, UUID bleServiceUuid, String serviceType) {
            super(context, listener, bleServiceUuid, serviceType);
        }

        @Override
        public boolean isBleMultipleAdvertisementSupported() {
            return mockmBleMultipleAdvertisementSupported;
        }

    }
}