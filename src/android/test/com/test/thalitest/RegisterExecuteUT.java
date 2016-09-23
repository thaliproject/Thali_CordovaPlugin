package com.test.thalitest;

import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.runner.Result;

import java.util.ArrayList;
import java.util.Date;

import io.jxcore.node.jxcore;

public final class RegisterExecuteUT {
    private RegisterExecuteUT() throws Exception {
        throw new Exception("Constructor should not be called.");

    }

    public static void Register() {
        jxcore.RegisterMethod("executeNativeTests", new jxcore.JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                String logtag = "executeNativeTests";
                Log.d(logtag, "Running unit tests");
                Result resultTest = ThaliTestRunner.runTests();

                JSONObject jsonObject = new JSONObject();
                Boolean jsonObjectCreated = false;

                try {
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
