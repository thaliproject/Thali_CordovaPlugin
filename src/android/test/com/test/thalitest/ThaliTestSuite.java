package com.test.thalitest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;

import io.jxcore.node.ConnectionHelperTest;
import io.jxcore.node.ConnectionModelTest;
import io.jxcore.node.ConnectivityMonitorTest;
import io.jxcore.node.LifeCycleMonitorTest;
import io.jxcore.node.ListenerOrIncomingConnectionTest;
import io.jxcore.node.StartStopOperationTest;
import io.jxcore.node.StreamCopyingThreadTest;

@RunWith(Suite.class)
@Suite.SuiteClasses({
        ConnectionHelperTest.class,
        ConnectionModelTest.class,
        ConnectivityMonitorTest.class,
        LifeCycleMonitorTest.class,
        ListenerOrIncomingConnectionTest.class,
        StartStopOperationTest.class,
        StreamCopyingThreadTest.class
})

public class ThaliTestSuite {
}
