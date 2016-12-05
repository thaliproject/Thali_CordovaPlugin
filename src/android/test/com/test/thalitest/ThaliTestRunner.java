package com.test.thalitest;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import io.jxcore.node.jxcore;

public class ThaliTestRunner {

    private final static String TAG = ThaliTestRunner.class.getName();
    public final static int TIMEOUT_LIMIT = 500;
    public final static int COUNTER_LIMIT = 10;

    final static BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
    final static WifiManager wifiManager =
        (WifiManager) jxcore.activity.getBaseContext().getSystemService(Context.WIFI_SERVICE);

    public static Callable<Boolean> createCheckRadiosThread() {
        return new Callable<Boolean>() {
            int counter = 0;

            @Override
            public Boolean call() throws Exception {
                while (!btAdapter.isEnabled() && !wifiManager.isWifiEnabled() && counter < COUNTER_LIMIT) {
                    try {
                        Thread.sleep(TIMEOUT_LIMIT);
                        counter++;
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        return false;
                    }
                }
                return !(counter >= ThaliTestRunner.COUNTER_LIMIT);
            }
        };
    }

    public static boolean turnOnRadios() {
        btAdapter.enable();
        wifiManager.setWifiEnabled(true);

        ExecutorService es = Executors.newSingleThreadExecutor();
        Future<Boolean> future = es.submit(createCheckRadiosThread());

        try {
            return future.get(5000, TimeUnit.MILLISECONDS);
        } catch (InterruptedException | ExecutionException | TimeoutException e) {
            e.printStackTrace();
            future.cancel(true);
            return false;
        }
    }

    public static Result runTests() {
        boolean isWifiAndBTOn = turnOnRadios();

        if (isWifiAndBTOn) {
            try {
                Thread.sleep(10000);
                /*
                 This sleep is here because we need to wait some time to BT and WiFi turn on.
                 The problem I believe is that android already see them as turned on, when in fact
                 they are not, and few tests fails because of this.
                 Turning on radios in app.js probably works but it is delayed.
                 */
            } catch (InterruptedException e) {
                e.printStackTrace();
            }

            Log.i(TAG, "Running UT");

            Result result = JUnitCore.runClasses(ThaliTestSuite.class);

            for (Failure failure : result.getFailures()) {
                Log.e(TAG, failure.getTestHeader());
                Log.e(TAG, failure.getMessage());
                Log.e(TAG, failure.getTrace());
            }

            return result;
        } else {
            Log.e(TAG, "Error during turning on radios!");
            return new Result();
        }
    }
}
