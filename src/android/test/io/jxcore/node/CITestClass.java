package io.jxcore.node;

import org.junit.Test;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNull.notNullValue;

public class CITestClass {
    @Test
    public void test() throws Exception {
        String str = "TestingString";
        assertThat("String is not null", str, is(notNullValue()));
    }
}
