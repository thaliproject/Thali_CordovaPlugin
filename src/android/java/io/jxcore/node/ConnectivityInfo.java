/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.util.Log;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;

/**
 * Monitors the connectivity status and provides notifications on connectivity state changes for
 * the node layer.
 */
class ConnectivityInfo {
    private static final String TAG = ConnectivityInfo.class.getName();
    private final Activity mActivity = jxcore.activity;
    private final DiscoveryManager mDiscoveryManager;
    private final boolean mIsBluetoothSupported;
    private final boolean mIsWifiDirectSupported;
    private final boolean mIsBleMultipleAdvertisementSupported;
    private BroadcastReceiver mConnectivityBroadcastReceiver = null;
    private String mBssidName = null;
    private boolean mIsWifiEnabled = false;
    private boolean mIsBluetoothEnabled = false;
    private boolean mIsConnectedOrConnectingToActiveNetwork = false;
    private boolean mActiveNetworkTypeIsWifi = false;

    /**
     * Constructor.
     */
    public ConnectivityInfo(DiscoveryManager discoveryManager) {
        if (discoveryManager == null) {
            throw new IllegalArgumentException("Discovery manager is null");
        }

        mDiscoveryManager = discoveryManager;
        mIsBluetoothSupported = mDiscoveryManager.getBluetoothManager().isBluetoothSupported();
        mIsWifiDirectSupported = mDiscoveryManager.isWifiDirectSupported();
        mIsBleMultipleAdvertisementSupported = mDiscoveryManager.isBleMultipleAdvertisementSupported();
        mIsWifiEnabled = mDiscoveryManager.getWifiDirectManager().isWifiEnabled();
        mIsBluetoothEnabled = mDiscoveryManager.getBluetoothManager().isBluetoothEnabled();
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
        return mIsWifiDirectSupported;
    }

    public boolean isBluetoothSupported() {
        return mIsBluetoothSupported;
    }

    public boolean isBleMultipleAdvertisementSupported() {
        return mIsBleMultipleAdvertisementSupported;
    }

    public boolean isWifiEnabled() {
        return mIsWifiEnabled;
    }

    public void setIsWifiEnabled(boolean isEnabled) {
        if (mIsWifiEnabled != isEnabled) {
            mIsWifiEnabled = isEnabled;
            mIsBluetoothEnabled = mDiscoveryManager.getBluetoothManager().isBluetoothEnabled();
            updateConnectivityInfo(true);
        }
    }

    public boolean isBluetoothEnabled() {
        return mIsBluetoothEnabled;
    }

    public void setIsBluetoothEnabled(boolean isEnabled) {
        if (mIsBluetoothEnabled != isEnabled) {
            mIsWifiEnabled = mDiscoveryManager.getWifiDirectManager().isWifiEnabled();
            mIsBluetoothEnabled = isEnabled;
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

        WifiInfo wifiInfo = null;

        if (activeNetworkTypeIsWifi && activeNetworkInfo.isConnected()) {
            final WifiManager wifiManager = (WifiManager) mActivity.getSystemService(Context.WIFI_SERVICE);
            wifiInfo = wifiManager.getConnectionInfo();
        }

        final String bssid = (wifiInfo != null) ? wifiInfo.getBSSID() : null;

        if (forceNotify ||
                (!stringsMatch(mBssidName, bssid)
                        || mIsConnectedOrConnectingToActiveNetwork != isConnectedOrConnecting
                        || mActiveNetworkTypeIsWifi != activeNetworkTypeIsWifi)) {
            mBssidName = bssid;
            mIsConnectedOrConnectingToActiveNetwork = isConnectedOrConnecting;
            mActiveNetworkTypeIsWifi = activeNetworkTypeIsWifi;

            Log.i(TAG, "updateConnectivityInfo: "
                    + "\n    - is Wi-Fi Direct supported: " + mIsWifiDirectSupported
                    + "\n    - is Bluetooth LE multiple advertisement supported: " + mIsBleMultipleAdvertisementSupported
                    + "\n    - is Wi-Fi enabled: " + mIsWifiEnabled
                    + "\n    - is Bluetooth enabled: " + mIsBluetoothEnabled
                    + "\n    - BSSID name: " + mBssidName
                    + "\n    - is connected/connecting to active network: " + mIsConnectedOrConnectingToActiveNetwork
                    + "\n    - active network type is Wi-Fi: " + mActiveNetworkTypeIsWifi
                    + "\n    - force notify: " + forceNotify);

            mActivity.runOnUiThread(new Runnable() {
                public void run() {
                    JXcoreExtension.notifyNetworkChanged(mIsBluetoothEnabled, mIsWifiEnabled, mBssidName);
                }
            });
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
