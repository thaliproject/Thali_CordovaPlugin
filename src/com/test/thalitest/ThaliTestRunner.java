package com.test.thalitest;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;

public class ThaliTestRunner {
    public static boolean runTests() {
        Result result = JUnitCore.runClasses(ThaliTestSuite.class);

        for (Failure failure: result.getFailures()) {
            System.out.println(failure.toString());
        }

        return result.wasSuccessful();
    }
}
