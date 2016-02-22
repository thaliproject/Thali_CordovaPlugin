/* Copyright (c) 2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

/**
 * A utility class for delayed/asynchronous JXcore callbacks.
 */
abstract class JXcoreThaliCallback {
    private final ListenerOrIncomingConnection mListenerOrIncomingConnection = new ListenerOrIncomingConnection();
    private String mErrorMessage = null;

    /**
     * @return The ListenerOrIncomingConnection instance. Guaranteed not be null.
     */
    public ListenerOrIncomingConnection getListenerOrIncomingConnection() {
        return mListenerOrIncomingConnection;
    }

    public String getErrorMessage() {
        return mErrorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        mErrorMessage = errorMessage;
    }

    /**
     * This is the callback used by {@link external:"Mobile('connect')".callNative}.
     * <p/>
     * If err is not NULL then listenerOrIncomingConnection MUST be null and vice
     * versa.
     *
     * @param errorMessage                 If null then the call the callback was submitted to was
     *                                     successful. If not null then it will be an Error object that will define what
     *                                     went wrong.
     * @param listenerOrIncomingConnection If null then the call the callback was
     *                                     submitted to failed. Otherwise this
     *                                     contains the success results.
     */
    abstract void onConnectCallback(
            String errorMessage, ListenerOrIncomingConnection listenerOrIncomingConnection);
}
