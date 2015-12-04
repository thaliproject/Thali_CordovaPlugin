package io.jxcore.node;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.util.Log;
import org.json.JSONException;
import org.json.JSONObject;

/**
 *
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
        final boolean isWiFi = (activeNetwork != null && activeNetwork.getType() == ConnectivityManager.TYPE_WIFI);

        Log.i(TAG, "sendConnectivityInfo: isConnected: " + isConnected + ", isWiFi: " + isWiFi);

        mActivity.runOnUiThread(new Runnable() {
                public void run() {
                JSONObject jsonObject = new JSONObject();

                try {
                    jsonObject.put(JXcoreExtension.EVENTVALUESTRING_REACHABLE, isConnected);

                    if (isConnected) {
                        jsonObject.put(JXcoreExtension.EVENTVALUESTRING_WIFI, isWiFi);
                    }
                } catch (JSONException e) {
                    Log.e(TAG, "Failed to create a JSON object: " + e.getMessage(), e);
                }

                jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_NETWORKCHANGED, jsonObject.toString());
            }
        });
    }
}
