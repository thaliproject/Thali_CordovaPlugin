/* Copyright (c) 2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.util.Log;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Utility class for JXcoreThaliCallback.
 */
class ListenerOrIncomingConnection {
    private static final String TAG = ListenerOrIncomingConnection.class.getSimpleName();
    private int mListeningOnPortNumber = 0;
    private int mClientPortNumber = 0;
    private int mServerPortNumber = 0;

    /**
     * Constructor.
     *
     * @param listeningOnPortNumber The port on which the native layer is listening on 127.0.0.1 for
     *                              an incoming TCP/IP connection that the native layer will then
     *                              relay to the remote peer.
     * @param clientPortNumber      clientPort The port that the native layer's TCP/IP client uses to
     *                              connect to the `portNumber` submitted by the Thali application.
     * @param serverPortNumber      The port that the native layer's TCP/IP client connected to. The
     *                              reason we include it here is because there is a potential race
     *                              condition where between the time we created the response to the
     *                              connect request and when it was actually sent to Node.js in theory we
     *                              could have received a stop and start that switched us to a different
     *                              `portNumber`. So by including `serverPort` we can catch those race
     *                              conditions.
     */
    public ListenerOrIncomingConnection(int listeningOnPortNumber, int clientPortNumber, int serverPortNumber) {
        mListeningOnPortNumber = listeningOnPortNumber;
        mClientPortNumber = clientPortNumber;
        mServerPortNumber = serverPortNumber;
    }

    /**
     * Constructor.
     */
    public ListenerOrIncomingConnection() {
        mListeningOnPortNumber = ConnectionHelper.NO_PORT_NUMBER;
        mClientPortNumber = ConnectionHelper.NO_PORT_NUMBER;
        mServerPortNumber = ConnectionHelper.NO_PORT_NUMBER;
    }

    public int getListeningOnPortNumber() {
        return mListeningOnPortNumber;
    }

    public void setListeningOnPortNumber(int listeningOnPortNumber) {
        mListeningOnPortNumber = listeningOnPortNumber;
    }

    public JSONObject toJsonObject() {
        try {
            JSONObject jsonObject = new JSONObject();
            jsonObject.put(JXcoreExtension.CALLBACK_VALUE_LISTENING_ON_PORT_NUMBER, mListeningOnPortNumber);
            jsonObject.put(JXcoreExtension.CALLBACK_VALUE_CLIENT_PORT_NUMBER, mClientPortNumber);
            jsonObject.put(JXcoreExtension.CALLBACK_VALUE_SERVER_PORT_NUMBER, mServerPortNumber);
            return jsonObject;
        } catch (JSONException e) {
            Log.e(TAG, "toJsonObject: Failed to populate the JSON object: " + e.getMessage(), e);
        }

        return null;
    }

    public String toString() {
        JSONObject jsonObject = toJsonObject();

        if (jsonObject != null) {
            return jsonObject.toString();
        }

        return null;
    }
}
