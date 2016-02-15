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
import android.util.Log;

/**
 * Monitors the connectivity status and provides notifications on connectivity state changes for
 * the node layer.
 */
class ConnectivityMonitor {
    private static final String TAG = ConnectivityMonitor.class.getName();
    private final Activity mActivity = jxcore.activity;
    private BroadcastReceiver mConnectivityBroadcastReceiver = null;

    /**
     * Constructor.
     */
    public ConnectivityMonitor() {
    }

    public synchronized void start() {
        stop();
        IntentFilter filter = new IntentFilter();
        filter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);

        try {
            mConnectivityBroadcastReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    sendConnectivityInfo();
                }
            };

            mActivity.registerReceiver(mConnectivityBroadcastReceiver, filter);

            // TODO: Fix this once we know how to get events that all is ready
            sendConnectivityInfo();
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Failed to register the broadcast receiver: " + e.getMessage(), e);
        }
    }

    public synchronized void stop() {
        if (mConnectivityBroadcastReceiver != null) {
            try {
                mActivity.unregisterReceiver(mConnectivityBroadcastReceiver);
            } catch (IllegalArgumentException e) {
                Log.e(TAG, "Failed to unregister the broadcast receiver: " + e.getMessage(), e);
            }

            mConnectivityBroadcastReceiver = null;
        }
    }

    private void sendConnectivityInfo() {
        ConnectivityManager connectivity =
                (ConnectivityManager) mActivity.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetwork = connectivity.getActiveNetworkInfo();

        final boolean isConnected = (activeNetwork != null && activeNetwork.isConnectedOrConnecting());
        final boolean isWifi = (activeNetwork != null && activeNetwork.getType() == ConnectivityManager.TYPE_WIFI);

        Log.i(TAG, "sendConnectivityInfo: isConnected: " + isConnected + ", isWifi: " + isWifi);

        mActivity.runOnUiThread(new Runnable() {
            public void run() {
                JXcoreExtension.notifyNetworkChanged(isConnected, isWifi);
            }
        });
    }
}
