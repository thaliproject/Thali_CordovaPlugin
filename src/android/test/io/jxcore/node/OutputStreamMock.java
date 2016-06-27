package io.jxcore.node;

import java.io.IOException;
import java.io.OutputStream;

public class OutputStreamMock extends OutputStream {
    public boolean isClosed = false;

    @Override
    public void write(int oneByte) throws IOException {

    }

    @Override
    public void close() throws IOException {
        isClosed = true;
    }
}
