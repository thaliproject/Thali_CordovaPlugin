package com.test.thalitest;

import android.content.Context;

import org.junit.BeforeClass;
import org.junit.AfterClass;
import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.thaliproject.p2p.btconnectorlib.ConnectionManager;
import org.thaliproject.p2p.btconnectorlib.DiscoveryManager;

import java.util.UUID;

import io.jxcore.node.ConnectionHelper;
import io.jxcore.node.ConnectionHelperTest;
import io.jxcore.node.ConnectionModel;
import io.jxcore.node.ConnectionModelTest;
import io.jxcore.node.ConnectivityMonitorTest;
import io.jxcore.node.IncomingSocketThreadTest;
import io.jxcore.node.JXcoreThaliCallbackMock;
import io.jxcore.node.LifeCycleMonitorTest;
import io.jxcore.node.ListenerOrIncomingConnectionTest;
import io.jxcore.node.OutgoingSocketThreadTest;
import io.jxcore.node.SocketThreadBaseTest;
import io.jxcore.node.StartStopOperationHandlerTest;
import io.jxcore.node.StartStopOperationTest;

@RunWith(Suite.class)
@Suite.SuiteClasses({
        ConnectionModelTest.class,
        ConnectivityMonitorTest.class,
        LifeCycleMonitorTest.class,
        ListenerOrIncomingConnectionTest.class,
        StartStopOperationTest.class,
        IncomingSocketThreadTest.class,
        OutgoingSocketThreadTest.class,
        SocketThreadBaseTest.class,
        StartStopOperationHandlerTest.class,
        ConnectionHelperTest.class
})

public class ThaliTestSuite {
    static ConnectionHelper mConnectionHelper;
    static JXcoreThaliCallbackMock mJXcoreThaliCallbackMock;

    @BeforeClass
    public static void setUp() {
        mConnectionHelper = new ConnectionHelper();
        mJXcoreThaliCallbackMock = new JXcoreThaliCallbackMock();

        ConnectionHelperTest.mConnectionHelper = mConnectionHelper;
        ConnectionHelperTest.mJXcoreThaliCallbackMock = mJXcoreThaliCallbackMock;
    }

    @AfterClass
    public static void tearDown() throws InterruptedException {
        mConnectionHelper.stop(false, mJXcoreThaliCallbackMock);
        mConnectionHelper.dispose();
        mConnectionHelper.getDiscoveryManager().stop();
        mConnectionHelper.getDiscoveryManager().stopAdvertising();
        mConnectionHelper.getDiscoveryManager().stopDiscovery();
        mConnectionHelper.getDiscoveryManager().dispose();
    }
}
