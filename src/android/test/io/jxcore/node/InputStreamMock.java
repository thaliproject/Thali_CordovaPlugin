package io.jxcore.node;

import java.io.IOException;
import java.io.InputStream;

public class InputStreamMock extends InputStream {
    public boolean isClosed = false;

    @Override
    public int read() throws IOException {
        return 0;
    }

    @Override
    public void close() throws IOException {
        isClosed = true;
    }
}
