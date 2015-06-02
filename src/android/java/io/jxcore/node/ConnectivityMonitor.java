package io.jxcore.node;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;

/**
 * Created by juksilve on 14.5.2015.
 */
public class ConnectivityMonitor {

    BroadcastReceiver receiver = null;

  //  BtConnectorHelper.jxCallBack jxcore = null; // remove the line
    Activity activity = jxcore.activity;

    public ConnectivityMonitor(/*Activity Context, BtConnectorHelper.jxCallBack callBack*/){
/*        jxcore = callBack;
        activity = Context;*/
    }

    public void Start(){
        Stop();
        IntentFilter filter = new IntentFilter();
        filter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);

        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                SendConnectivityInfo();
            }
        };

        activity.registerReceiver(receiver, filter);

        //To do fix this once we know how to get events that all is ready !
        SendConnectivityInfo();
    }

    public void Stop(){
        if(receiver != null) {
            activity.unregisterReceiver(receiver);
            receiver = null;
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

                String reply = "";
                if (isConnected) {
                    reply = "{\"isReachable\":\"" + isConnected + "\", " + "\"isWiFi\":\"" + isWiFi + "\"}";
                } else {
                    reply = "{\"isReachable\":\"" + isConnected + "\"}";
                }

                jxcore.CallJSMethod("networkChanged", reply);
            }
        });
    }
}
