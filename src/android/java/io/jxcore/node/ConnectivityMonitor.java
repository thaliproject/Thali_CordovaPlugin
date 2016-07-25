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
import org.thaliproject.p2p.btconnectorlib.internal.bluetooth.BluetoothManager;
import org.thaliproject.p2p.btconnectorlib.internal.wifi.WifiDirectManager;

/**
 * Monitors the connectivity status and provides notifications on connectivity state changes for
 * the node layer.
 */
class ConnectivityMonitor implements BluetoothManager.BluetoothManagerListener {
    private static final String TAG = ConnectivityMonitor.class.getName();
    private final Activity mActivity = jxcore.activity;
    private final BluetoothManager mBluetoothManager;
    private final WifiDirectManager mWifiDirectManager;
    private WifiStateChangedAndConnectivityActionBroadcastReceiver mWifiStateChangedAndConnectivityActionBroadcastReceiver = null;
    private String mBssidName = null;
    private boolean mIsConnectedOrConnectingToActiveNetwork = false;
    private boolean mActiveNetworkTypeIsWifi = false;
    private boolean mIsBluetoothEnabled = false;
    private boolean mIsWifiEnabled = false;

    /**
     * Constructor.
     */
    public ConnectivityMonitor(DiscoveryManager discoveryManager) {
        if (discoveryManager == null) {
            throw new IllegalArgumentException("Discovery manager is null");
        }

        mBluetoothManager = discoveryManager.getBluetoothManager();
        mWifiDirectManager = discoveryManager.getWifiDirectManager();
        mIsBluetoothEnabled = mBluetoothManager.isBluetoothEnabled();
        mIsWifiEnabled = mWifiDirectManager.isWifiEnabled();
    }

    /**
     * Registers the broadcast receivers for connectivity and Wi-Fi state changes.
     *
     * @return True, if successful (or was already started). False otherwise.
     */
    public synchronized boolean start() {
        if (mWifiStateChangedAndConnectivityActionBroadcastReceiver != null) {
            Log.v(TAG, "start: Already started");
            return true;
        }

        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction(WifiManager.WIFI_STATE_CHANGED_ACTION);
        intentFilter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);
        mWifiStateChangedAndConnectivityActionBroadcastReceiver = new WifiStateChangedAndConnectivityActionBroadcastReceiver();

        try {
            mActivity.registerReceiver(mWifiStateChangedAndConnectivityActionBroadcastReceiver, intentFilter);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "start: Failed to register the broadcast receiver for Wi-Fi state and connectivity changes: " + e.getMessage(), e);
            mWifiStateChangedAndConnectivityActionBroadcastReceiver = null;
        }

        if (mWifiStateChangedAndConnectivityActionBroadcastReceiver != null) {
            // Success
            mBluetoothManager.bind(this);
            updateConnectivityInfo(true);
            Log.d(TAG, "start: OK");
            return true;
        }

        // Failed
        stop();
        return false;
    }

    /**
     * Stops monitoring connectivity, Wi-Fi and Bluetooth state changes.
     */
    public synchronized void stop() {
        Log.d(TAG, "stop");
        mBluetoothManager.release(this);

        if (mWifiStateChangedAndConnectivityActionBroadcastReceiver != null) {
            try {
                mActivity.unregisterReceiver(mWifiStateChangedAndConnectivityActionBroadcastReceiver);
            } catch (IllegalArgumentException e) {
                Log.e(TAG, "stop: Failed to unregister the broadcast receiver for Wi-Fi state and connectivity changes: " + e.getMessage(), e);
            }

            mWifiStateChangedAndConnectivityActionBroadcastReceiver = null;
        }
    }

    public boolean isBluetoothSupported() {
        return mBluetoothManager.isBluetoothSupported();
    }

    public BluetoothManager.FeatureSupportedStatus isBleMultipleAdvertisementSupported() {
        return mBluetoothManager.isBleMultipleAdvertisementSupported();
    }

    public boolean isBluetoothEnabled() {
        return mIsBluetoothEnabled;
    }

    public boolean isWifiDirectSupported() {
        return mWifiDirectManager.isWifiDirectSupported();
    }

    public boolean isWifiEnabled() {
        return mIsWifiEnabled;
    }

    /**
     * Called when Bluetooth is enabled or disabled.
     *
     * @param mode The new Bluetooth mode.
     */
    @Override
    public void onBluetoothAdapterScanModeChanged(int mode) {
        updateConnectivityInfo(false);
    }

    /**
     * Called when Bluetooth is enabled or disabled.
     *
     * @param mode The new Bluetooth mode.
     */@Override
    public void onBluetoothAdapterStateChanged(int mode) {
        updateConnectivityInfo(false);
    }

    /**
     * Checks the connectivity info and requests a listener to be notified, if the status has
     * essentially changed.
     *
     * @param forceNotify If true, will notify even if nothing has changed.
     */
    public synchronized void updateConnectivityInfo(boolean forceNotify) {
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

        final boolean isBluetoothEnabled = mBluetoothManager.isBluetoothEnabled();

        boolean notificationNecessary =
                (forceNotify
                        || mIsBluetoothEnabled != isBluetoothEnabled
                        || mIsWifiEnabled != isWifiEnabled
                        || !stringsMatch(mBssidName, bssid));

        boolean unimportantStateChange =
                (mIsConnectedOrConnectingToActiveNetwork != isConnectedOrConnecting
                        || mActiveNetworkTypeIsWifi != activeNetworkTypeIsWifi);

        if (notificationNecessary || unimportantStateChange) {
            // Store the state and log even if this was an unimportant state change
            mIsBluetoothEnabled = isBluetoothEnabled;
            mIsWifiEnabled = isWifiEnabled;
            mBssidName = bssid;
            mIsConnectedOrConnectingToActiveNetwork = isConnectedOrConnecting;
            mActiveNetworkTypeIsWifi = activeNetworkTypeIsWifi;

            Log.v(TAG, "updateConnectivityInfo: " + (forceNotify ? "FORCED notification:" : "State changed:")
                    + "\n    - is Wi-Fi Direct supported: " + isWifiDirectSupported()
                    + "\n    - is Bluetooth LE multiple advertisement supported: " + isBleMultipleAdvertisementSupported()
                    + "\n    - is Wi-Fi enabled: " + mIsWifiEnabled
                    + "\n    - is Bluetooth enabled: " + mIsBluetoothEnabled
                    + "\n    - BSSID name: " + mBssidName
                    + "\n    - is connected/connecting to active network: " + mIsConnectedOrConnectingToActiveNetwork
                    + "\n    - active network type is Wi-Fi: " + mActiveNetworkTypeIsWifi);

            if (notificationNecessary) {
                JXcoreExtension.notifyNetworkChanged(mIsBluetoothEnabled, mIsWifiEnabled, mBssidName);
            }
        } else {
            Log.v(TAG, "updateConnectivityInfo: No relevant state changes");
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

    /**
     * Broadcast receiver for Wi-Fi state and connectivity changes.
     */
    private class WifiStateChangedAndConnectivityActionBroadcastReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            updateConnectivityInfo(false);
        }
    }
}
