/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.net.wifi.p2p.WifiP2pManager;
import android.util.Log;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothManager;
import org.thaliproject.p2p.btconnectorlib.internal.wifi.WifiDirectManager;

/**
 * Monitors the connectivity status and provides notifications on connectivity state changes for
 * the node layer.
 */
class ConnectivityInfo implements WifiDirectManager.WifiStateListener, BluetoothManager.BluetoothManagerListener {
    private static final String TAG = ConnectivityInfo.class.getName();
    private final Activity mActivity = jxcore.activity;
    private final BluetoothManager mBluetoothManager;
    private final WifiDirectManager mWifiDirectManager;
    private BroadcastReceiver mConnectivityBroadcastReceiver = null;
    private String mBssidName = null;
    private boolean mIsConnectedOrConnectingToActiveNetwork = false;
    private boolean mActiveNetworkTypeIsWifi = false;
    private boolean mIsBluetoothEnabled = false;
    private boolean mIsWifiEnabled = false;

    /**
     * Constructor.
     */
    public ConnectivityInfo(DiscoveryManager discoveryManager) {
        if (discoveryManager == null) {
            throw new IllegalArgumentException("Discovery manager is null");
        }

        mBluetoothManager = discoveryManager.getBluetoothManager();
        mWifiDirectManager = discoveryManager.getWifiDirectManager();

        mBluetoothManager.bind(this);
        mWifiDirectManager.bind(this);

        mIsBluetoothEnabled = mBluetoothManager.isBluetoothEnabled();
        mIsWifiEnabled = mWifiDirectManager.isWifiEnabled();
    }

    /**
     * Should be called when this class instance is no longer needed.
     * Note that after calling this method, this instance cannot be used anymore.
     */
    public void dispose() {
        mBluetoothManager.release(this);
        mWifiDirectManager.release(this);
    }

    /**
     * Registers the broadcast received for connectivity changes.
     *
     * @return True, if successful. False otherwise.
     */
    public synchronized boolean startMonitoring() {
        if (mConnectivityBroadcastReceiver == null) {
            IntentFilter filter = new IntentFilter();
            filter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);

            try {
                mConnectivityBroadcastReceiver = new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context context, Intent intent) {
                        updateConnectivityInfo(false);
                    }
                };

                mActivity.registerReceiver(mConnectivityBroadcastReceiver, filter);
                updateConnectivityInfo(true);
                Log.d(TAG, "startMonitoring: OK");
            } catch (IllegalArgumentException e) {
                Log.e(TAG, "startMonitoring: Failed to register the broadcast receiver: " + e.getMessage(), e);
                mConnectivityBroadcastReceiver = null;
            }
        } else {
            Log.v(TAG, "startMonitoring: Already started");
        }

        return (mConnectivityBroadcastReceiver != null);
    }

    /**
     * Stops monitoring connectivity actions (except Bluetooth and Wi-Fi enabled/disabled events).
     */
    public synchronized void stopMonitoring() {
        if (mConnectivityBroadcastReceiver != null) {
            try {
                mActivity.unregisterReceiver(mConnectivityBroadcastReceiver);
                Log.d(TAG, "stopMonitoring: Stopped");
            } catch (IllegalArgumentException e) {
                Log.e(TAG, "stopMonitoring: Failed to unregister the broadcast receiver: " + e.getMessage(), e);
            }

            mConnectivityBroadcastReceiver = null;
        }
    }

    public boolean isWifiDirectSupported() {
        return mWifiDirectManager.isWifiDirectSupported();
    }

    public boolean isBluetoothSupported() {
        return mBluetoothManager.isBluetoothSupported();
    }

    public boolean isBleMultipleAdvertisementSupported() {
        return (mBluetoothManager.isBleMultipleAdvertisementSupported() != BluetoothManager.FeatureSupportedStatus.NOT_SUPPORTED);
    }

    public boolean isWifiEnabled() {
        return mWifiDirectManager.isWifiEnabled();
    }

    public boolean isBluetoothEnabled() {
        return mBluetoothManager.isBluetoothEnabled();
    }

    /**
     * Called when Bluetooth is enabled or disabled.
     *
     * @param mode The new Bluetooth mode.
     */
    @Override
    public void onBluetoothAdapterScanModeChanged(int mode) {
        boolean isBluetoothEnabled = (mode != BluetoothAdapter.SCAN_MODE_NONE);

        if (mIsBluetoothEnabled != isBluetoothEnabled) {
            Log.d(TAG, "onBluetoothAdapterScanModeChanged: Bluetooth " + (isBluetoothEnabled ? "enabled" : "disabled"));
            mIsBluetoothEnabled = isBluetoothEnabled;
            updateConnectivityInfo(true);
        }
    }

    /**
     * Called when Wi-Fi is enabled or disabled.
     *
     * @param state The new Wi-Fi state.
     */
    @Override
    public void onWifiStateChanged(int state) {
        boolean isWifiEnabled = (state != WifiP2pManager.WIFI_P2P_STATE_DISABLED);

        if (mIsWifiEnabled != isWifiEnabled) {
            Log.d(TAG, "onWifiStateChanged: Wi-Fi " + (isWifiEnabled ? "enabled" : "disabled"));
            mIsWifiEnabled = isWifiEnabled;
            updateConnectivityInfo(true);
        }
    }

    /**
     * Checks the connectivity info and requests a listener to be notified, if the status has changed.
     *
     * @param forceNotify If true, will notify even if nothing has changed.
     */
    public void updateConnectivityInfo(boolean forceNotify) {
        ConnectivityManager connectivityManager =
                (ConnectivityManager) mActivity.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();

        final boolean isConnectedOrConnecting = (activeNetworkInfo != null && activeNetworkInfo.isConnectedOrConnecting());
        final boolean activeNetworkTypeIsWifi = (activeNetworkInfo != null && activeNetworkInfo.getType() == ConnectivityManager.TYPE_WIFI);

        WifiManager wifiManager = (WifiManager) mActivity.getSystemService(Context.WIFI_SERVICE);
        WifiInfo wifiInfo = null;
        boolean isWifiEnabled = false;

        if (wifiManager != null) {
            isWifiEnabled = wifiManager.isWifiEnabled();

            if (activeNetworkTypeIsWifi && activeNetworkInfo.isConnected()) {
                wifiInfo = wifiManager.getConnectionInfo();
            }
        }

        final String bssid = (wifiInfo != null) ? wifiInfo.getBSSID() : null;

        if (forceNotify ||
                (!stringsMatch(mBssidName, bssid)
                        || mIsConnectedOrConnectingToActiveNetwork != isConnectedOrConnecting
                        || mActiveNetworkTypeIsWifi != activeNetworkTypeIsWifi)) {
            boolean isBluetoothEnabled = isBluetoothEnabled();
            mBssidName = bssid;
            mIsConnectedOrConnectingToActiveNetwork = isConnectedOrConnecting;
            mActiveNetworkTypeIsWifi = activeNetworkTypeIsWifi;

            Log.v(TAG, "updateConnectivityInfo: "
                    + "\n    - is Wi-Fi Direct supported: " + isWifiDirectSupported()
                    + "\n    - is Bluetooth LE multiple advertisement supported: " + isBleMultipleAdvertisementSupported()
                    + "\n    - is Wi-Fi enabled: " + isWifiEnabled
                    + "\n    - is Bluetooth enabled: " + isBluetoothEnabled
                    + "\n    - BSSID name: " + mBssidName
                    + "\n    - is connected/connecting to active network: " + mIsConnectedOrConnectingToActiveNetwork
                    + "\n    - active network type is Wi-Fi: " + mActiveNetworkTypeIsWifi
                    + "\n    - force notify: " + forceNotify);

            JXcoreExtension.notifyNetworkChanged(isBluetoothEnabled, isWifiEnabled, mBssidName);
        }
    }

    /**
     * Compares the two given string and checks whether they match or not.
     *
     * @param oldString The old string.
     * @param newString The new string.
     * @return True, if the string match. False otherwise.
     */
    private boolean stringsMatch(String oldString, String newString) {
        return (oldString == null ? newString == null : oldString.equals(newString));
    }
}
