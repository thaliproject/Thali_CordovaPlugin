/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

/**
 * The connection status listener interface.
 */
abstract class ConnectionStatusListener {
    /**
     * Called when we have a connection ready.
     * @param portNumber The port listening to.
     */
    void onListeningForIncomingConnections(int portNumber) {
    }

    /**
     * Called when connected successfully.
     * @param port The port number associated with the connection.
     */
    void onConnected(int port) {
    }

    /**
     * Called when data is transferred (read and/or written).
     * @param numberOfBytes The number of bytes of data transferred.
     */
    void onDataTransferred(int numberOfBytes) {
    }

    /**
     * Called when disconnected.
     * @param who The thread, which reported the event.
     * @param errorMessage The error message.
     */
    abstract void onDisconnected(SocketThreadBase who, String errorMessage);
}
