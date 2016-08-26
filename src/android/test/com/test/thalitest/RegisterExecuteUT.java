package com.test.thalitest;

import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Date;

import io.jxcore.node.ConnectionHelper;
import io.jxcore.node.ConnectionHelperTest;
import io.jxcore.node.jxcore;

public final class RegisterExecuteUT {
    private RegisterExecuteUT() throws Exception {
        throw new Exception("Constructor should not be called.");
    }

    static String TAG = "RegisterExecuteUT";

    private static void FireTestedMethod(String methodName) {
        ConnectionHelperTest.mConnectionHelper = new ConnectionHelper();
        try {
                if(methodName.equals("onPeerLost")){
                    Method onPeerLostMethod = ConnectionHelperTest.mConnectionHelper.getClass().getMethod(methodName, PeerProperties.class);
                    onPeerLostMethod.invoke(ConnectionHelperTest.mConnectionHelper, new PeerProperties("11:22:33:22:11:00"));
                }
                if(methodName.equals("onPeerDiscovered")){
                    Method onPeerDiscoveredMethod = ConnectionHelperTest.mConnectionHelper.getClass().getMethod(methodName, PeerProperties.class);
                    onPeerDiscoveredMethod.invoke(ConnectionHelperTest.mConnectionHelper, new PeerProperties("33:44:55:44:33:22"));
                }
            } catch (IllegalAccessException e) {
                e.printStackTrace();
            } catch (NoSuchMethodException e) {
                e.printStackTrace();
            } catch (InvocationTargetException e) {
                e.printStackTrace();
            }
        }

    public static void Register() {
        jxcore.RegisterMethod("TestNativeMethod", new jxcore.JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, final String callbackId) {
                String methodToTest = "";

                if (params.size() == 0) {
                    Log.e(TAG, "Required parameter (toast message) missing");
                } else {
                    methodToTest = params.get(0).toString();
                    FireTestedMethod(methodToTest);
                }

                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }

                JSONObject jsonObject = new JSONObject();
                try {
                    jsonObject.put("Testing_", methodToTest);
                } catch (JSONException e) {
                    e.printStackTrace();
                }
                final String jsonObjectAsString = jsonObject.toString();

                jxcore.CallJSMethod(callbackId, jsonObjectAsString);
            }
        });

        jxcore.RegisterMethod("executeNativeTests", new jxcore.JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                String logtag = "executeNativeTests";
                Log.d(logtag, "Running unit tests");
                Result resultTest = ThaliTestRunner.runTests();

                JSONObject jsonObject = new JSONObject();
                Boolean jsonObjectCreated = false;
                String failures = "";

                for (Failure failure: resultTest.getFailures()) {
                    failures += failure.getMessage() + "\n";
                }

                try {
                    if(!failures.equals("")){
                        jsonObject.put("failures", failures);
                    }

                    jsonObject.put("total", resultTest.getRunCount());
                    jsonObject.put("passed", resultTest.getRunCount() -
                            resultTest.getFailureCount() - resultTest.getIgnoreCount());
                    jsonObject.put("failed", resultTest.getFailureCount());
                    jsonObject.put("ignored", resultTest.getIgnoreCount());
                    jsonObject.put("duration", new Date(resultTest.getRunTime()).getTime());
                    jsonObject.put("executed", true);
                    jsonObjectCreated = true;
                } catch (JSONException e) {
                    Log.e(logtag, "executeNativeTests: " +
                            "Failed to populate the JSON object: " + e.getMessage(), e);
                }

                if (jsonObjectCreated) {
                    final String jsonObjectAsString = jsonObject.toString();

                    jxcore.CallJSMethod(callbackId, jsonObjectAsString);
                }
            }
        });
    }
}
