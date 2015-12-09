package io.jxcore.node;

/**
 * The connection status listener interface.
 */
abstract class ConnectionStatusListener {
    /**
     * Called when we have a connection ready.
     * @param port The port listening to.
     */
    void onListeningForIncomingConnections(int port) {
    }

    /**
     * Called when connected successfully.
     * @param port The port number associated with the connection.
     */
    void onConnected(int port) {
    }

    /**
     * Called when disconnected.
     * @param who The thread, which reported the event.
     * @param errorMessage The error message.
     */
    abstract void onDisconnected(SocketThreadBase who, String errorMessage);
}
