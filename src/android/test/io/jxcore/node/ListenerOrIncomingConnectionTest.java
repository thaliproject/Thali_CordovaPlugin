package io.jxcore.node;

import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

import java.lang.reflect.Field;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.core.IsNot.not;

public class ListenerOrIncomingConnectionTest {

    ListenerOrIncomingConnection mListenerOrIncomingConnection;
    int listeningPortNumberSample;
    int clientPortNumberSample;
    int serverPortNumberSample;

    @Before
    public void setUp() throws Exception {
        mListenerOrIncomingConnection = new ListenerOrIncomingConnection();
        listeningPortNumberSample = 1111;
        clientPortNumberSample = 2222;
        serverPortNumberSample = 3333;
    }

    @Test
    public void testDefaultConstructor() throws Exception {
        Field fListeningOnPortNumber =
                mListenerOrIncomingConnection.getClass().getDeclaredField("mListeningOnPortNumber");
        Field fClientPortNumber =
                mListenerOrIncomingConnection.getClass().getDeclaredField("mClientPortNumber");
        Field fServerPortNumber =
                mListenerOrIncomingConnection.getClass().getDeclaredField("mServerPortNumber");

        fListeningOnPortNumber.setAccessible(true);
        fClientPortNumber.setAccessible(true);
        fServerPortNumber.setAccessible(true);

        int mListeningOnPortNumber = fListeningOnPortNumber.getInt(mListenerOrIncomingConnection);
        int mClientPortNumber = fClientPortNumber.getInt(mListenerOrIncomingConnection);
        int mServerPortNumber = fServerPortNumber.getInt(mListenerOrIncomingConnection);

        assertThat("mListenerOrIncomingConnection should not be null", mListenerOrIncomingConnection,
                is(notNullValue()));
        assertThat("mListeningOnPortNumber should be 0", mListeningOnPortNumber, is(equalTo(0)));
        assertThat("mClientPortNumber should be 0", mClientPortNumber, is(equalTo(0)));
        assertThat("mServerPortNumber should be 0", mServerPortNumber, is(equalTo(0)));
    }

    @Test
    public void testConstructorWithParameters() throws Exception {
        mListenerOrIncomingConnection = new ListenerOrIncomingConnection(
                listeningPortNumberSample, clientPortNumberSample, serverPortNumberSample);

        Field fListeningOnPortNumber =
                mListenerOrIncomingConnection.getClass().getDeclaredField("mListeningOnPortNumber");
        Field fClientPortNumber =
                mListenerOrIncomingConnection.getClass().getDeclaredField("mClientPortNumber");
        Field fServerPortNumber =
                mListenerOrIncomingConnection.getClass().getDeclaredField("mServerPortNumber");

        fListeningOnPortNumber.setAccessible(true);
        fClientPortNumber.setAccessible(true);
        fServerPortNumber.setAccessible(true);

        int mListeningOnPortNumber = fListeningOnPortNumber.getInt(mListenerOrIncomingConnection);
        int mClientPortNumber = fClientPortNumber.getInt(mListenerOrIncomingConnection);
        int mServerPortNumber = fServerPortNumber.getInt(mListenerOrIncomingConnection);

        assertThat("mListenerOrIncomingConnection should not be null", mListenerOrIncomingConnection,
                is(notNullValue()));
        assertThat("mListeningOnPortNumber should be 1111", mListeningOnPortNumber,
                is(equalTo(listeningPortNumberSample)));
        assertThat("mListeningOnPortNumber should not be 1010", mListeningOnPortNumber,
                is(not(equalTo(1010))));
        assertThat("mClientPortNumber should be 2222", mClientPortNumber,
                is(equalTo(clientPortNumberSample)));
        assertThat("mClientPortNumber should not be 2020", mClientPortNumber,
                is(not(equalTo(2020))));
        assertThat("mServerPortNumber should be 3333", mServerPortNumber,
                is(equalTo(serverPortNumberSample)));
        assertThat("mServerPortNumber should not be 3030", mServerPortNumber,
                is(not(equalTo(3030))));
    }

    @Test
    public void testGetListeningOnPortNumber() throws Exception {
        assertThat("getListeningOnPortNumber should return proper value",
                mListenerOrIncomingConnection.getListeningOnPortNumber(), is(equalTo(0)));

        mListenerOrIncomingConnection = new ListenerOrIncomingConnection(
                listeningPortNumberSample, clientPortNumberSample, serverPortNumberSample);
        assertThat("getListeningOnPortNumber should return proper value",
                mListenerOrIncomingConnection.getListeningOnPortNumber(),
                is(equalTo(listeningPortNumberSample)));
    }

    @Test
    public void testSetListeningOnPortNumber() throws Exception {
        assertThat("ListeningOnPortNumber should be 0",
                mListenerOrIncomingConnection.getListeningOnPortNumber(), is(equalTo(0)));

        mListenerOrIncomingConnection.setListeningOnPortNumber(listeningPortNumberSample);
        assertThat("ListeningOnPortNumber should be 1111",
                mListenerOrIncomingConnection.getListeningOnPortNumber(),
                is(equalTo(listeningPortNumberSample)));

        mListenerOrIncomingConnection.setListeningOnPortNumber(1010);
        assertThat("ListeningOnPortNumber should be 1010",
                mListenerOrIncomingConnection.getListeningOnPortNumber(), is(equalTo(1010)));
    }

    @Test
    public void testToJsonObject() throws Exception {
        JSONObject mJSONObject = mListenerOrIncomingConnection.toJsonObject();

        int mListeningPortNumber =
                mJSONObject.getInt(JXcoreExtension.CALLBACK_VALUE_LISTENING_ON_PORT_NUMBER);
        int mClientPortNumber =
                mJSONObject.getInt(JXcoreExtension.CALLBACK_VALUE_CLIENT_PORT_NUMBER);
        int mServerPortNumber =
                mJSONObject.getInt(JXcoreExtension.CALLBACK_VALUE_SERVER_PORT_NUMBER);

        assertThat("mJSONObject should not be null", mJSONObject, is(notNullValue()));
        assertThat("mListeningPortNumber should be 0", mListeningPortNumber, is(equalTo(0)));
        assertThat("mClientPortNumber should be 0", mClientPortNumber, is(equalTo(0)));
        assertThat("mServerPortNumber should be 0", mServerPortNumber, is(equalTo(0)));

        mListenerOrIncomingConnection = new ListenerOrIncomingConnection(
                listeningPortNumberSample, clientPortNumberSample, serverPortNumberSample);

        mJSONObject = mListenerOrIncomingConnection.toJsonObject();
        mListeningPortNumber =
                mJSONObject.getInt(JXcoreExtension.CALLBACK_VALUE_LISTENING_ON_PORT_NUMBER);
        mClientPortNumber =
                mJSONObject.getInt(JXcoreExtension.CALLBACK_VALUE_CLIENT_PORT_NUMBER);
        mServerPortNumber =
                mJSONObject.getInt(JXcoreExtension.CALLBACK_VALUE_SERVER_PORT_NUMBER);

        assertThat("mJSONObject should not be null", mJSONObject, is(notNullValue()));
        assertThat("mListeningPortNumber should be 1111", mListeningPortNumber,
                is(equalTo(listeningPortNumberSample)));
        assertThat("mClientPortNumber should be 2222", mClientPortNumber,
                is(equalTo(clientPortNumberSample)));
        assertThat("mServerPortNumber should be 3333", mServerPortNumber,
                is(equalTo(serverPortNumberSample)));
    }

    @Test
    public void testToString() throws Exception {
        mListenerOrIncomingConnection = new ListenerOrIncomingConnection(
                listeningPortNumberSample, clientPortNumberSample, serverPortNumberSample);

        JSONObject mJSONObject = mListenerOrIncomingConnection.toJsonObject();
        String mJSONToString = mListenerOrIncomingConnection.toString();

        assertThat("mJSONToString should not be null", is(notNullValue()));
        assertThat("mJSONObject.toString and mJOSNToString should be equal",
                mJSONObject.toString(), is(equalTo(mJSONToString)));
    }
}
