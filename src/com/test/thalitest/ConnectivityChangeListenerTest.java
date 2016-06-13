package com.test.thalitest;

import android.content.Context;
import android.net.ConnectivityManager;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import io.jxcore.node.ConnectivityChangeListener;

import static org.hamcrest.CoreMatchers.is;
import static org.junit.Assert.assertThat;
import android.net.ConnectivityManager;

/**
 * Created by MLesnic on 6/10/2016.
 */
public class ConnectivityChangeListenerTest {

    @Mock
    ConnectivityChangeListener mConnectivityChangeListener;

    @Before
    public void setUp() throws Exception {
        MockitoAnnotations.initMocks(this);
    }
    @After
    public void tearDown() throws Exception {
    }

    @Test
    public void testOnReceive(){
    }
}
