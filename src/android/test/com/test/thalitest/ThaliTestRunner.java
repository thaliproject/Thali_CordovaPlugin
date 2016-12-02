package com.test.thalitest;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;

public class ThaliTestRunner {

    public final static int TIMEOUT_LIMIT = 500;
    public final static int COUNTER_LIMIT = 10;

    public static Result runTests() {
        Result result = JUnitCore.runClasses(ThaliTestSuite.class);

        return result;
    }
}