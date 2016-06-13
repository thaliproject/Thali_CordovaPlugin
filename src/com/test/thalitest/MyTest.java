package com.test.thalitest;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import io.jxcore.node.ConnectionHelper;
import io.jxcore.node.jxcore;

import static org.junit.Assert.assertThat;
import static org.hamcrest.CoreMatchers.is;

public class MyTest {
    @Mock
    MyClass myClass;

    @Before
    public void setUp() throws Exception {
        MockitoAnnotations.initMocks(this);
    }

    @After
    public void tearDown() throws Exception {

    }

    @Test
    public void testMyClassMyMethod(){
        ConnectionHelper ch = new ConnectionHelper();

        assertThat(myClass.myMethod(), is(false));
        System.out.println("Inside testMyClassMyMethod: "+ myClass.myMethod());
    }


}
