package io.jxcore.node;

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

    @Override
    public void onDone(SocketThreadBase who, boolean threadDoneWasSending){

    }

}
