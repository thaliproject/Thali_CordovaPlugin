package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Message;
import android.util.Log;

import org.thaliproject.p2p.btconnectorlib.BTConnector;
import org.thaliproject.p2p.btconnectorlib.BTConnectorSettings;
import org.thaliproject.p2p.btconnectorlib.ServiceItem;

import java.net.ServerSocket;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Created by juksilve on 14.5.2015.
 */
public class BtConnectorHelper implements BTConnector.Callback, BTConnector.ConnectSelector {

    Context context = null;

    final String instanceEncryptionPWD = "CHANGEYOURPASSWRODHERE";
    final String serviceTypeIdentifier = "Cordovap2p._tcp";
    final String BtUUID                = "fa87c0d0-afac-11de-8a39-0800200c9a66";
    final String Bt_NAME               = "Thaili_Bluetooth";


    List<ServiceItem> lastAvailableList = new ArrayList<ServiceItem>();

    BTConnectorSettings conSettings = null;
    BTConnector mBTConnector = null;

    BtToServerSocket mBtToServerSocket = null;
    BtToRequestSocket mBtToRequestSocket = null;
    String myPeerIdentifier= "";
    String myPeerName = "";

    int mServerPort = 0;

    public BtConnectorHelper() {
        conSettings = new BTConnectorSettings();
        conSettings.SERVICE_TYPE = serviceTypeIdentifier;
        conSettings.MY_UUID = UUID.fromString(BtUUID);
        conSettings.MY_NAME = Bt_NAME;
        this.context = jxcore.activity.getBaseContext();
    }


    public BTConnector.WifiBtStatus Start(String peerName,int port){
        this.mServerPort = port;
        this.myPeerIdentifier= GetBluetoothAddress();
        this.myPeerName = peerName;
        this.lastAvailableList.clear();
        Stop();
        mBTConnector = new BTConnector(context,this,this,conSettings,instanceEncryptionPWD);
        return mBTConnector.Start(this.myPeerIdentifier,this.myPeerName);
    }

    public void Stop(){
        if(mBTConnector != null){
            mBTConnector.Stop();
            mBTConnector = null;
        }

        if (mBtToServerSocket != null) {
            print_debug("Disconnect:::Stop : mBtToServerSocket");
            mBtToServerSocket.Stop();
            mBtToServerSocket = null;
        }

        if(mBtToRequestSocket != null) {
            print_debug("Disconnect:::Stop : mBtToRequestSocket");
            mBtToRequestSocket.Stop();
            mBtToRequestSocket = null;
        }
    }

    public boolean Disconnect(String peerId){

        boolean ret = false;

// we only cut off our outgoing connections, incoming ones are cut off from the other end.
// if we want to cut off whole communications, we'll do Stop

        if(mBtToRequestSocket != null) {
            String currentpeerId = mBtToRequestSocket.GetPeerId();
            print_debug("Disconnect : " + peerId + ", current request : " + currentpeerId);
            if(peerId.length() == 0 || peerId.equalsIgnoreCase(currentpeerId)) {
                print_debug("Disconnect:::Stop :" + currentpeerId);
                mBtToRequestSocket.Stop();
                mBtToRequestSocket = null;
                ret = true;
            }
        }

        return ret;
    }
    public String GetBluetoothAddress(){

        String ret= "";
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        if(bluetooth != null){
            ret = bluetooth.getAddress();
        }

        return ret;
    }

    public String GetDeviceName(){

        String ret= "";
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        if(bluetooth != null){
            ret = bluetooth.getName();
        }

        return ret;
    }
    public int getFreePort() {
        int ret =-1;
        try {
            ServerSocket s = new ServerSocket(0);
            ret = s.getLocalPort();
            //print_debug("srvSocket got port: " +ret);
            s.close();
        }catch (Exception e){
            print_debug("create ServerSocket failed: "  + e.toString());
        }

        return ret;
    }
    public boolean SetDeviceName(String name){

        boolean  ret= false;
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        if(bluetooth != null){
            ret = bluetooth.setName(name);
        }

        return ret;
    }
    public String GetKeyValue(String key) {
        SharedPreferences sharedPref = jxcore.activity.getPreferences(Context.MODE_PRIVATE);
        return sharedPref.getString(key, null);
    }

    public void SetKeyValue(String key, String value) {
        SharedPreferences sharedPref = jxcore.activity.getPreferences(Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.putString(key, value);
        editor.commit();
    }

    public String  MakeGUID() {
        return UUID.randomUUID().toString();
    }

    ConnectStatusCallback mConnectStatusCallback = null;
    public interface ConnectStatusCallback{
        void ConnectionStatusUpdate(String Error, int port);
    }

    public void BeginConnectPeer(String toPeerId, ConnectStatusCallback connectStatusCallback) {
        ConnectStatusCallback tmpCallback = connectStatusCallback;

        if(tmpCallback == null) {
            //nothing we should do, since we can not update progress
            print_debug("BeginConnectPeer callback is NULL !!!!!!");
        }else if(mBtToRequestSocket != null) {
            tmpCallback.ConnectionStatusUpdate("Already connected to " + mBtToRequestSocket.GetPeerId(),-1);
        }else {
            ServiceItem selectedDevice = null;
            if (lastAvailableList != null) {
                for (int i = 0; i < lastAvailableList.size(); i++) {
                    if (lastAvailableList.get(i).peerId.contentEquals(toPeerId)) {
                        selectedDevice = lastAvailableList.get(i);
                        break;
                    }
                }
            }

            if (selectedDevice != null) {
                if (mBTConnector != null) {
                    BTConnector.TryConnectReturnValues retVal = mBTConnector.TryConnect(selectedDevice);
                    if (retVal == BTConnector.TryConnectReturnValues.Connecting) {
                        //all is ok, lets wait callbacks, and for them lets copy the callback here
                        mConnectStatusCallback = connectStatusCallback;
                    } else if (retVal == BTConnector.TryConnectReturnValues.NoSelectedDevice) {
                        // we do check this already, thus we should not get this ever.
                        tmpCallback.ConnectionStatusUpdate("Device Address for " + toPeerId + " not found from Discovered device list.",-1);
                    } else if (retVal == BTConnector.TryConnectReturnValues.AlreadyAttemptingToConnect) {
                        tmpCallback.ConnectionStatusUpdate("There is already one connection attempt progressing.",-1);
                    } else if (retVal == BTConnector.TryConnectReturnValues.BTDeviceFetchFailed) {
                        tmpCallback.ConnectionStatusUpdate("Bluetooth API failed to get Bluetooth device for the address : " + selectedDevice.peerAddress,-1);
                    }

                } else {
                    tmpCallback.ConnectionStatusUpdate("Device conenctivity not started, please call StartBroadcasting before attempting to connnect",-1);
                }
            } else {
                tmpCallback.ConnectionStatusUpdate("Device Address for " + toPeerId + " not found from Discovered device list.",-1);
            }
        }
    }

    @Override
    public void Connected(BluetoothSocket bluetoothSocket, boolean incoming,String peerId,String peerName,String peerAddress) {

        if(bluetoothSocket != null) {

            boolean okToContinue = true;

            // See when we could support multiple connections
            if(incoming && mBtToServerSocket != null) {
                print_debug("Got connection while having old one, will disconnect" );
                try{
                    bluetoothSocket.close();
                }catch (Exception e){
                    print_debug("Errro while disconnecting : " + e.toString());
                }
            }else {

                // basically we should never get to make successful connection
                // if we already have one outgoing, so the old if it would somehow be there
                // would be invalid, so lets get rid of it if we are having new outgoing connection.
                //if (!incoming && mBtToRequestSocket != null)

                AddPeerIfNotDiscovered(bluetoothSocket, peerId, peerName, peerAddress);
                print_debug("Starting the connected thread incoming : " + incoming);

                if (incoming) {
                    mBtToServerSocket = new BtToServerSocket(bluetoothSocket, mHandler);
                    mBtToServerSocket.SetIdAddressAndName(peerId, peerName, peerAddress);
                    mBtToServerSocket.setPort(this.mServerPort);
                    mBtToServerSocket.start();

                    int port = mBtToServerSocket.GetLocalHostPort();
                    print_debug("Server socket is using : " + port + ", and is now connected.");

                } else {

                    if(mBtToRequestSocket != null){
                        mBtToRequestSocket.Stop();
                        mBtToRequestSocket = null;
                    }

                    mBtToRequestSocket = new BtToRequestSocket(bluetoothSocket, mHandler);
                    mBtToRequestSocket.SetIdAddressAndName(peerId, peerName, peerAddress);
                    mBtToRequestSocket.setPort(getFreePort());
                    mBtToRequestSocket.start();

                    int port = mBtToRequestSocket.GetLocalHostPort();
                    print_debug("Request socket is using : " + port);
                    if(mConnectStatusCallback != null){
                        print_debug("Calling ConnectionStatusUpdate with port :" + port);
                        mConnectStatusCallback.ConnectionStatusUpdate(null,port);
                    }
                }
            }
        }
    }

    public void AddPeerIfNotDiscovered(BluetoothSocket bluetoothSocket, String peerId,String peerName,String peerAddress) {

        if (lastAvailableList == null) {
            lastAvailableList = new ArrayList<ServiceItem>();
        }

        boolean isDiscovered = false;

        for (int i = 0; i < lastAvailableList.size(); i++) {
            if (lastAvailableList.get(i).peerId.contentEquals(peerId)) {
                isDiscovered = true;
                break;
            }
        }
        if (!isDiscovered) {
            String BtAddress = peerAddress;
            if(bluetoothSocket != null){
                if(bluetoothSocket.getRemoteDevice() != null){
                    BtAddress = bluetoothSocket.getRemoteDevice().getAddress();
                }
            }

            ServiceItem tmpSrv = new ServiceItem(peerId,peerName,BtAddress, "", "","");
            lastAvailableList.add(tmpSrv);

            String reply = "[";
            reply = reply + getAvailabilityStatus(tmpSrv, true);
            reply = reply +"]";
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, reply);
        }
    }

    @Override
    public void ConnectionFailed(String peerId, String peerName, String peerAddress) {
        if(mConnectStatusCallback != null){
            mConnectStatusCallback.ConnectionStatusUpdate("Connection to " + peerId + " failed",-1);
        }
    }

    @Override
    public void StateChanged(BTConnector.State state) {

        // with this version, we don't  use this state information for anything
        switch (state) {
            case Idle:
                break;
            case NotInitialized:
                break;
            case WaitingStateChange:
                break;
            case FindingPeers:
                break;
            case FindingServices:
                break;
            case Connecting:
                break;
            case Connected:
                break;
        };

    }

    // this is called with a full list of peer-services we see, its takes time to get,
    // since there is time spend between each peer we discover
    // anyway, this list can be used for determining whether the peer we saw earlier has now disappeared
    // will be called null or empty list, if no services are found during some time period.

    @Override
    public ServiceItem CurrentPeersList(List<ServiceItem> serviceItems) {

        String reply = "[";
        Boolean wasPrevouslyAvailable = false;

        if(serviceItems != null) {
            for (int i = 0; i < serviceItems.size(); i++) {

                wasPrevouslyAvailable = false;
                ServiceItem item = serviceItems.get(i);
                if (lastAvailableList != null) {
                    for (int ll = (lastAvailableList.size() - 1); ll >= 0; ll--) {
                        if (item.deviceAddress.equalsIgnoreCase(lastAvailableList.get(ll).deviceAddress)) {
                            wasPrevouslyAvailable = true;
                            lastAvailableList.remove(ll);
                        }
                    }
                }

                if (!wasPrevouslyAvailable) {
                    if (reply.length() > 3) {
                        reply = reply + ",";
                    }
                    reply = reply + getAvailabilityStatus(item, true);
                }
            }
        }

        if(lastAvailableList != null) {
            for (int ii = 0; ii < lastAvailableList.size(); ii++) {
                if (reply.length() > 3) {
                    reply = reply + ",";
                }
                reply = reply + getAvailabilityStatus(lastAvailableList.get(ii), false);
                lastAvailableList.remove(ii);
            }
        }

        reply = reply +"]";

        if(serviceItems != null) {
            for (int iii = 0; iii < serviceItems.size(); iii++) {
                lastAvailableList.add(serviceItems.get(iii));
            }
        }

        // lets not sent any empty arrays up.
        if(reply.length() > 5) {
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, reply);
        }
        return null;
    }

    // this is called when we see a peer, so we can inform the app of its availability right when we see it
    @Override
    public void PeerDiscovered(ServiceItem serviceItem) {
        boolean wasPrevouslyAvailable = false;

        if (lastAvailableList != null) {
            for (int ll = (lastAvailableList.size() - 1); ll >= 0; ll--) {
                if (serviceItem.deviceAddress.equalsIgnoreCase(lastAvailableList.get(ll).deviceAddress)) {
                    wasPrevouslyAvailable = true;
                }
            }
        }

        if (!wasPrevouslyAvailable) {
            lastAvailableList.add(serviceItem);
            String stateReply = "[" + getAvailabilityStatus(serviceItem, true) + "]";
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, stateReply);
        }
    }

    private String getAvailabilityStatus(ServiceItem item, boolean available) {
        String reply = "";
        if(item != null) {
            reply = "{\"" + JXcoreExtension.EVENTVALUESTRING_PEERID + "\":\"" + item.peerId + "\", " + "\"" + JXcoreExtension.EVENTVALUESTRING_PEERNAME + "\":\"" + item.peerName + "\", " + "\"" + JXcoreExtension.EVENTVALUESTRING_PEERAVAILABLE + "\":\"" + available + "\"}";
        }
        return reply;
    }

    // The Handler that gets disconnection events
    private final Handler mHandler = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch (msg.what) {
                case BtToRequestSocket.SOCKET_DISCONNEDTED:{
                    if(mBtToRequestSocket != null) {
                        print_debug("BT Request socket disconnected");
                        mBtToRequestSocket.Stop();
                        mBtToRequestSocket = null;
                    }
                }
                break;
                case BtToServerSocket.SOCKET_DISCONNEDTED: {
                    if (mBtToServerSocket != null) {
                        print_debug("BT Server socket disconnected");
                        mBtToServerSocket.Stop();
                        mBtToServerSocket = null;
                    }
                }
                break;
            }
        }
    };

    public void print_debug(String message){
        Log.i("!!!!hekpper!!", message);
    }
}
