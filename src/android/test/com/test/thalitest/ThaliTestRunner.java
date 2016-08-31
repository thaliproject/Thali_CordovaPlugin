package com.test.thalitest;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;

public class ThaliTestRunner {

    public static Result runTests() {
        Result result = JUnitCore.runClasses(ThaliTestSuite.class);

        return result;
    }
}
