package io.jxcore.node;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;

import org.json.JSONException;
import org.json.JSONObject;

import io.jxcore.node.JXcoreExtension;
import io.jxcore.node.jxcore;

/**
 * Created by juksilve on 14.5.2015.
 */
public class ConnectivityMonitor {

    BroadcastReceiver receiver = null;
    Activity activity = jxcore.activity;

    public ConnectivityMonitor(){}

    public void Start() {
        Stop();
        IntentFilter filter = new IntentFilter();
        filter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);

        try {
            receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    SendConnectivityInfo();
                }
            };

            activity.registerReceiver(receiver, filter);
            //To do fix this once we know how to get events that all is ready !
            SendConnectivityInfo();
        } catch (Exception e) {e.printStackTrace();}
    }

    public void Stop() {
        BroadcastReceiver tmpRec= receiver;
        receiver = null;
        if (tmpRec != null) {
            try {
                activity.unregisterReceiver(tmpRec);
            } catch (Exception e) {e.printStackTrace();}
        }
    }

    public void SendConnectivityInfo() {

        ConnectivityManager connectivity = (ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetwork = connectivity.getActiveNetworkInfo();

        final boolean isConnected = activeNetwork != null && activeNetwork.isConnectedOrConnecting();
        final boolean isWiFi =  activeNetwork != null && activeNetwork.getType() == ConnectivityManager.TYPE_WIFI;

//        Log.i("ConnectivityMonitor", "isConnected  = " + isConnected);
//        Log.i("ConnectivityMonitor", "isWiFi  = " + isWiFi);

        activity.runOnUiThread(new Runnable() {
            public void run() {

                JSONObject tmp = new JSONObject();
                try {
                    tmp.put(JXcoreExtension.EVENTVALUESTRING_REACHABLE, isConnected);
                    if(isConnected) {
                        tmp.put(JXcoreExtension.EVENTVALUESTRING_WIFI, isWiFi);
                    }
                } catch (JSONException e) {
                    // TODO Auto-generated catch block
                    e.printStackTrace();
                }

                jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_NETWORKCHANGED, tmp.toString());
            }
        });
    }
}
