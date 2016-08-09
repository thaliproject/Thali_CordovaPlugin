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

        return result;
    }
}
