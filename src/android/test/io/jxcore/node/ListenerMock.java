package io.jxcore.node;

import io.jxcore.node.SocketThreadBase;

public class ListenerMock implements SocketThreadBase.Listener {

    @Override
    public void onListeningForIncomingConnections(int portNumber) {

    }

    @Override
    public void onDataTransferred(int numberOfBytes) {

    }

    @Override
    public void onDisconnected(SocketThreadBase who, String errorMessage) {

    }
}
