package com.test.thalitest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;

@RunWith(Suite.class)
@Suite.SuiteClasses({
    MyTest.class,
    ConnectivityChangeListenerTest.class,
    FileManagerTest.class
})

public class ThaliTestSuite {
}
