package io.jxcore.node;

import android.content.Context;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothManager;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.MatcherAssert.assertThat;

public class ConnectivityMonitorTest {


    class DiscoveryManagerListenerMock implements DiscoveryManager.DiscoveryManagerListener {

        @Override
        public boolean onPermissionCheckRequired(String s) {
            return false;
        }

        @Override
        public void onDiscoveryManagerStateChanged(DiscoveryManager.DiscoveryManagerState discoveryManagerState, boolean b, boolean b1) {

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

    class DiscoveryManagerMock extends DiscoveryManager {

        boolean mockmBleMultipleAdvertisementSupported;

        public DiscoveryManagerMock(Context context, DiscoveryManagerListener listener, UUID bleServiceUuid, String serviceType) {
            super(context, listener, bleServiceUuid, serviceType);
        }

        @Override
        public boolean isBleMultipleAdvertisementSupported() {
            return mockmBleMultipleAdvertisementSupported;
        }


    }


    DiscoveryManagerListenerMock mDiscoveryManagerListenerMock;
    DiscoveryManagerMock mDiscoveryManagerMock;
    ConnectivityMonitor mConnectivityMonitor;
    BluetoothManager mBluetoothManager;


    @Before
    public void setUp() throws Exception {
        mDiscoveryManagerListenerMock = new DiscoveryManagerListenerMock();
        Context cnx = jxcore.activity.getBaseContext();

        mDiscoveryManagerMock = new DiscoveryManagerMock(cnx, mDiscoveryManagerListenerMock, new UUID(1,1), "");

        mConnectivityMonitor = new ConnectivityMonitor(mDiscoveryManagerMock);

        Field field = mDiscoveryManagerMock.getClass().getSuperclass().getSuperclass().getDeclaredField("mBluetoothManager");

        field.setAccessible(true);

        mBluetoothManager = (BluetoothManager) field.get(mDiscoveryManagerMock);

        mBluetoothManager.isBluetoothSupported();




    }

    @After
    public void tearDown() throws Exception {
        mDiscoveryManagerMock.dispose();
    }


    @Test
    public void testStart() throws Exception {

    }
//
//    @Test
//    public void testStop() throws Exception {
//
//    }

//    @Test
//    public void testIsBluetoothSupported() throws Exception {
//        mDiscoveryManagerMock.mockmBleMultipleAdvertisementSupported = false;
//
//        assertThat("Cannot close already closed IncommingConnectionThread",
//                mConnectivityMonitor.isBleMultipleAdvertisementSupported(), is(false));
//
//    }

//    @Test
//    public void testIsBleMultipleAdvertisementSupported() throws Exception {
//
//    }
//
//    @Test
//    public void testIsBluetoothEnabled() throws Exception {
//
//    }
//
//    @Test
//    public void testIsWifiDirectSupported() throws Exception {
//
//    }
//
//    @Test
//    public void testIsWifiEnabled() throws Exception {
//
//    }
//
//    @Test
//    public void testOnBluetoothAdapterScanModeChanged() throws Exception {
//
//    }
//
//    @Test
//    public void testUpdateConnectivityInfo() throws Exception {
//
//    }
}