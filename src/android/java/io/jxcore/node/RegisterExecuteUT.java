package io.jxcore.node;

import android.annotation.SuppressLint;
import android.util.Log;

import com.test.thalitest.ThaliTestRunner;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.runner.Result;

import java.util.ArrayList;
import java.util.Date;

public class RegisterExecuteUT {
    public RegisterExecuteUT(){
        jxcore.RegisterMethod("ExecuteNativeTests", new jxcore.JXcoreCallback() {
            @SuppressLint("NewApi")
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                Log.d("UTtests", "Running tests");
                Result resultTest = ThaliTestRunner.runTests();

                JSONObject jsonObject = new JSONObject();
                Boolean jsonObjectCreated = false;

                try {
                    jsonObject.put("Total number of executed tests", resultTest.getRunCount());
                    jsonObject.put("Number of passed tests", resultTest.getRunCount() -
                            resultTest.getFailureCount() - resultTest.getIgnoreCount());
                    jsonObject.put("Number of failed tests", resultTest.getFailureCount());
                    jsonObject.put("Number of ignored tests", resultTest.getIgnoreCount());
                    jsonObject.put("Total duration", new Date(resultTest.getRunTime()).getTime());
                    jsonObject.put("UT TESTS FINISHED", true);
                    jsonObjectCreated = true;
                } catch (JSONException e) {
                    Log.e("RegisterExecuteUT", "executeNativeTests: Failed to populate the JSON object: " + e.getMessage(), e);
                }

                if (jsonObjectCreated) {
                    final String jsonObjectAsString = jsonObject.toString();

                    jxcore.CallJSMethod(callbackId, jsonObjectAsString);
                }
            }
        });
    }
}
