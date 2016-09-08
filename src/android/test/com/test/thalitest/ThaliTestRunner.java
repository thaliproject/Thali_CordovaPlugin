package com.test.thalitest;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

import java.util.Date;

import io.jxcore.node.jxcore;

public class ThaliTestRunner {

    final static String mTag = ThaliTestRunner.class.getName();

    public static boolean turnOnRadios() {
        final BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
        btAdapter.enable();

        final WifiManager wifiManager =
                (WifiManager) jxcore.activity.getBaseContext().getSystemService(Context.WIFI_SERVICE);
        wifiManager.setWifiEnabled(true);

        Thread checkRadiosThread = new Thread(new Runnable() {
            int counter = 0;
            @Override
            public void run() {
                do {
                    try {
                        Thread.sleep(3000);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                } while (!btAdapter.isEnabled() && !wifiManager.isWifiEnabled() && counter < 2);
            }
        });

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
            Result result = JUnitCore.runClasses(ThaliTestSuite.class);

            for (Failure failure: result.getFailures()) {
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
