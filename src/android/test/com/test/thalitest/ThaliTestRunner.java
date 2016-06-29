package com.test.thalitest;

import org.apache.cordova.LOG;
import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

import java.util.Date;

public class ThaliTestRunner {
    public static boolean runTests() {
        String thaliLogTag = "THALI UNIT TEST";
        Result result = JUnitCore.runClasses(ThaliTestSuite.class);

        for (Failure failure : result.getFailures()) {
            LOG.e(thaliLogTag, failure.getMessage());
        }

        LOG.e(thaliLogTag, "Total number of executed tests: %s", result.getRunCount());
        LOG.e(thaliLogTag, "Number of passed tests: %s",
                (result.getRunCount() - result.getFailureCount() - result.getIgnoreCount()));
        LOG.e(thaliLogTag, "Number of failed tests:  %s", result.getFailureCount());
        LOG.e(thaliLogTag, "Number of ignored tests: %s", result.getIgnoreCount());
        LOG.e(thaliLogTag, "Total duration: %s ms", new Date(result.getRunTime()).getTime());

        return result.wasSuccessful();
    }
}
