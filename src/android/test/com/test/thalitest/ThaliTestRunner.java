package com.test.thalitest;

import android.util.Log;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import java.util.Date;

public class ThaliTestRunner {

    public static Result runTests() {
        Result result = JUnitCore.runClasses(ThaliTestSuite.class);
        String mTag = ThaliTestRunner.class.getName();

        for (Failure failure: result.getFailures()) {
            Log.e(mTag, failure.getMessage());
        }

        Log.d(mTag, "Total number of executed tests: " + result.getRunCount());
        Log.d(mTag, "Number of passed tests: " +
                (result.getRunCount() - result.getFailureCount() - result.getIgnoreCount()));
        Log.d(mTag, "Number of failed tests:  " + result.getFailureCount());
        Log.d(mTag, "Number of ignored tests: " + result.getIgnoreCount());
        Log.d(mTag, String.format("Total duration: %s ms", new Date(result.getRunTime()).getTime()));

        return result;
    }
}
