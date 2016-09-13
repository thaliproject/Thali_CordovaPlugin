package com.test.thalitest;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

import io.jxcore.node.jxcore;

public class ThaliTestRunner {
    
    final static String mTag = ThaliTestRunner.class.getName();
    public final static int timeoutLimit = 500;
    public final static int counterLimit = 10;
    
    final static BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
    final static WifiManager wifiManager =
    (WifiManager) jxcore.activity.getBaseContext().getSystemService(Context.WIFI_SERVICE);
    
    public static Thread createCheckRadiosThread() {
        return new Thread(new Runnable() {
            int counter = 0;
            
            @Override
            public void run() {
                while (!btAdapter.isEnabled() && !wifiManager.isWifiEnabled() && counter < counterLimit) {
                    try {
                        Thread.sleep(timeoutLimit);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
                if (counter >= ThaliTestRunner.counterLimit) Log.e(mTag, "Radios didn't start after 5s!");
            }
        });
    }
    
    public static boolean turnOnRadios() {
        btAdapter.enable();
        wifiManager.setWifiEnabled(true);
        
        Thread checkRadiosThread = createCheckRadiosThread();
        
        try {
            checkRadiosThread.start();
            checkRadiosThread.join();
            return true;
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return false;
    }
    
    public static Result runTests() {
        boolean isBtAndWiFiOn = turnOnRadios();
        
        if (isBtAndWiFiOn) {
            System.out.println("Running UT");
            
            try {
                Thread.sleep(10000);
                /*
                 This sleep is here because we need to wait some time to BT and WiFi turn on.
                 The problem is that android already see them as turned on, when in fact
                 they are not, and few tests fails because of this.
                 Turning on radios in app.js probably works but it is delayed.
                 */
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            
            Result result = JUnitCore.runClasses(ThaliTestSuite.class);
            
            for (Failure failure : result.getFailures()) {
                Log.e(mTag, failure.getTestHeader());
                Log.e(mTag, failure.getMessage());
                Log.e(mTag, failure.getTrace());
            }
            
            return result;
        } else {
            Log.e(mTag, "Error during turning on radios!");
            return new Result();
        }
    }
}
