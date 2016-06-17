package io.jxcore.node;

import java.io.IOException;
import java.io.InputStream;

public class InputStreamMock extends InputStream {

    @Override
    public int read() throws IOException {
        return 0;
    }
}
