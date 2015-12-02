package io.jxcore.node;

/**
 *
 */
abstract class ConnectionStatusListener {
    /**
     * Called when we started listening for incoming connections.
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
     * Called when a connection fails.
     * @param errorMessage The error message.
     */
    void onConnectionError(String errorMessage) {
    }

    /**
     * Called when disconnected.
     * @param who The thread, which reported the event.
     * @param errorMessage The error message.
     */
    abstract void onDisconnected(SocketThreadBase who, String errorMessage);
}
