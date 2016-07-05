package com.test.thalitest;

import org.apache.cordova.LOG;
import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import java.util.Date;

public class ThaliTestRunner {

    public static Result runTests() {
        Result result = JUnitCore.runClasses(ThaliTestSuite.class);
        String mTag = ThaliTestRunner.class.getName();

        for (Failure failure: result.getFailures()) {
            LOG.e(mTag, failure.getMessage());
        }

        LOG.e(mTag, "Total number of executed tests: %s", result.getRunCount());
        LOG.e(mTag, "Number of passed tests: %s",
                (result.getRunCount() - result.getFailureCount() - result.getIgnoreCount()));
        LOG.e(mTag, "Number of failed tests:  %s", result.getFailureCount());
        LOG.e(mTag, "Number of ignored tests: %s", result.getIgnoreCount());
        LOG.e(mTag, "Total duration: %s ms", new Date(result.getRunTime()).getTime());

        return result;
    }
}