package com.test.thalitest;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

import io.jxcore.node.ConnectionHelper;

public class ThaliTestRunner {

    final static String mTag = ThaliTestRunner.class.getName();
    public final static int timeoutLimit = 500;
    public final static int counterLimit = 10;
    public static ConnectionHelper mConnectionHelper = new ConnectionHelper();
    
    //Global instance of ConnectionHelper used in tests.

    public static Thread createCheckDiscoveryManagerRunningThread() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (!mConnectionHelper
                        .getDiscoveryManager().isRunning() && counter < counterLimit) {
                    try {
                        Thread.sleep(timeoutLimit);
                        counter++;
                    } catch (InterruptedException e){
                        e.printStackTrace();
                    }
                }
                if (counter >= ThaliTestRunner.counterLimit) Log.e(mTag, "Discovery manager didn't start after 5s!");
            }
        });
    }

    public static Thread createCheckDiscoveryManagerNotRunningThread() {
        return new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                while (mConnectionHelper
                        .getDiscoveryManager().isRunning() && counter < counterLimit) {
                    try {
                        Thread.sleep(timeoutLimit);
                        counter++;
                    } catch (InterruptedException e){
                        e.printStackTrace();
                    }
                }
                if (counter >= ThaliTestRunner.counterLimit) Log.e(mTag, "Discovery manager still running after 5s!");
            }
        });
    }

    public static Result runTests() {
        try {
            Thread.sleep(10000);
                /*
                    This sleep is here because we need to wait some time to BT and WiFi turn on.
                    The problem is that android already see them as turned on, when in fact
                    they are not, and few tests fails because of this.
                    Turning on radios in app.js works but it is delayed.
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
    }
}
