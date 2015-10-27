package io.jxcore.node;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Handler;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.thaliproject.p2p.btconnectorlib.BTConnector;
import org.thaliproject.p2p.btconnectorlib.BTConnectorSettings;
import org.thaliproject.p2p.btconnectorlib.ServiceItem;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;


/**
 * Created by juksilve on 14.5.2015.
 */
public class BtConnectorHelper implements BTConnector.Callback, BTConnector.ConnectSelector {

    private final Context context;

    private final String serviceTypeIdentifier = "Cordovap2p._tcp";
    private final String BtUUID                = "0bbfc6ef-14cc-4ab2-af63-b92e887227ae";
    private final String Bt_NAME               = "Thali_Bluetooth";


    private final CopyOnWriteArrayList<ServiceItem> lastAvailableList = new CopyOnWriteArrayList<ServiceItem>();

    private final BTConnectorSettings conSettings;
    private BTConnector mBTConnector = null;

    private final CopyOnWriteArrayList<BtToServerSocket> mServerSocketList = new CopyOnWriteArrayList<BtToServerSocket>();
    private final CopyOnWriteArrayList<BtToRequestSocket> mRequestSocketList = new CopyOnWriteArrayList<BtToRequestSocket>();

    private int mServerPort = 0;

    // implementation which forwards any uncaught exception from threads to the Jxcore
    final Thread.UncaughtExceptionHandler mThreadUncaughtExceptionHandler = new Thread.UncaughtExceptionHandler() {
        @Override
        public void uncaughtException(Thread thread, Throwable ex) {
            final Throwable tmpException = ex;
            new Handler(jxcore.activity.getMainLooper()).post(new Runnable() {
                @Override
                public void run(){
                    throw new RuntimeException(tmpException);
                }
            });
        }
    };

    public BtConnectorHelper() {
        conSettings = new BTConnectorSettings();
        conSettings.SERVICE_TYPE = serviceTypeIdentifier;
        conSettings.MY_UUID = UUID.fromString(BtUUID);
        conSettings.MY_NAME = Bt_NAME;
        this.context = jxcore.activity.getBaseContext();
    }

    public BTConnector.WifiBtStatus Start(String peerName,int port){
        this.mServerPort = port;
       // this.lastAvailableList.clear();
        Stop();

        BTConnector tmpCon= new BTConnector(context,this,this,conSettings);
        BTConnector.WifiBtStatus  ret = tmpCon.Start(GetBluetoothAddress(),peerName);
        mBTConnector = tmpCon;

        if(lastAvailableList.size() > 0) {
            JSONArray jsonArray = new JSONArray();
            for (ServiceItem item : lastAvailableList) {
                jsonArray.put(getAvailabilityStatus(item, true));
            }
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, jsonArray.toString());
        }

        return ret;
    }

    public boolean isRunning(){
        return mBTConnector != null;
    }
    public void Stop(){

        BTConnector tmpCon = mBTConnector;
        mBTConnector = null;
        if(tmpCon != null){
            tmpCon.Stop();
        }

        //disconnect all incoming connections
        DisconnectIncomingConnections();

        // disconnect outgoing connection
        DisconnectAll ();
    }

    // we only cut off our outgoing connections, incoming ones are cut off from the other end.
    // if we want to cut off whole communications, we'll do Stop
    public boolean Disconnect(String peerId){

        for (BtToRequestSocket rSocket : mRequestSocketList) {
            if (rSocket != null) {
                String currentPeerId = rSocket.GetPeerId();
                if (peerId.equalsIgnoreCase(currentPeerId)) {
                    mRequestSocketList.remove(rSocket);
                    Log.i("BtConnectorHelper", "Disconnect outgoing peer: " + currentPeerId);
                    rSocket.Stop();
                    return true;
                }
            }
        }

        return false;
    }

    private void DisconnectAll(){

        for (BtToRequestSocket rSocket : mRequestSocketList) {
            if (rSocket != null) {
                mRequestSocketList.remove(rSocket);
                Log.i("BtConnectorHelper","Disconnect:::Stop : BtToRequestSocket :" + rSocket.getName());
                rSocket.Stop();
            }
        }

        mRequestSocketList.clear();
    }

    //function to disconnect all incoming connections
    // should only be used internally, i.e. should be private
    // but for testing time, this is marked as public, so we can simulate 'peer disappearing'
    // by cutting off the connection from the remote party
    public boolean  DisconnectIncomingConnections() {

        boolean ret = false;
        for (BtToServerSocket rSocket : mServerSocketList) {
            if (rSocket != null) {
                Log.i("BtConnectorHelper","Disconnect:::Stop : mBtToServerSocket :" + rSocket.getName());
                rSocket.Stop();
                ret = true;
            }
        }

        mServerSocketList.clear();

        return ret;
    }

    private String GetBluetoothAddress(){
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        return bluetooth == null ? "" : bluetooth.getAddress();
    }

    private ConnectStatusCallback mConnectStatusCallback = null;

    public interface ConnectStatusCallback{
        void ConnectionStatusUpdate(String Error, int port);
    }

    public void BeginConnectPeer(final String toPeerId, ConnectStatusCallback connectStatusCallback) {

        if (connectStatusCallback == null) {
            //nothing we should do, since we can not update progress
            throw new RuntimeException("BeginConnectPeer callback is NULL !!!!!!");
        }

        //todo what should we have here for the actual value ?
        if (mRequestSocketList.size() > 100) {
            connectStatusCallback.ConnectionStatusUpdate("Maximum peer connections reached, please try again after disconnecting a peer. Connected to " + mRequestSocketList.size() + " peers.", -1);
            return;
        }

        ServiceItem selectedDevice = null;

        for (ServiceItem item : lastAvailableList) {
            if (item != null && item.peerId.contentEquals(toPeerId)) {
                selectedDevice = item;
                break;
            }
        }

        if (selectedDevice == null) {
            connectStatusCallback.ConnectionStatusUpdate("Device Address for " + toPeerId + " not found from Discovered device list.", -1);
            return;
        }

        BTConnector tmpConn = mBTConnector;
        if (tmpConn == null) {
            connectStatusCallback.ConnectionStatusUpdate("Device connectivity not started, please call StartBroadcasting before attempting to connect", -1);
            return;
        }

        switch(tmpConn.TryConnect(selectedDevice)){
            case Connecting:{
                //all is ok, lets wait callbacks, and for them lets copy the callback here
                mConnectStatusCallback = connectStatusCallback;
            }
            break;
            case  NoSelectedDevice:{
                // we do check this already, thus we should not get this ever.
                connectStatusCallback.ConnectionStatusUpdate("Device Address for " + toPeerId + " not found from Discovered device list.", -1);
            }
            break;
            case  AlreadyAttemptingToConnect:{
                connectStatusCallback.ConnectionStatusUpdate("There is already one connection attempt progressing.", -1);
            }
            break;
            case  BTDeviceFetchFailed:{
                connectStatusCallback.ConnectionStatusUpdate("Bluetooth API failed to get Bluetooth device for the address : " + selectedDevice.peerAddress, -1);
            }
            break;
            default:
                throw new RuntimeException("Invalid value returned for BTConnector.TryConnectReturnValues with TryConnect");
        }
    }

    //this is always called in context of thread that created instance of the library
    @Override
    public void Connected(BluetoothSocket bluetoothSocket, boolean incoming,String peerId,String peerName,String peerAddress) {

        if (bluetoothSocket == null) {
            return;
        }

        // this is here, so if we have not found the incoming peer via Discovery, we'll get it
        // added to the discovery list, and we can connect back to it.
        AddPeerIfNotDiscovered(bluetoothSocket, peerId, peerName, peerAddress);
        Log.i("BtConnectorHelper","Starting the connected thread incoming : " + incoming + ", " + peerName);

        if (incoming) {
            BtToServerSocket tmpBtToServerSocket = null;
            try {
                tmpBtToServerSocket = new BtToServerSocket(bluetoothSocket, new BtSocketDisconnectedCallBack(){
                    //Called when disconnect event happens, so we can stop & clean everything now.
                    @Override
                    public void Disconnected(Thread who, String Error) {
                        Log.i("BtConnectorHelper","BT Disconnected with error : " + Error);

                        for (BtToServerSocket rSocket : mServerSocketList) {
                            if (rSocket != null && (rSocket.getId() == who.getId())) {
                                Log.i("BtConnectorHelper","Disconnect:::Stop : mBtToServerSocket :" + rSocket.GetPeerName());
                                rSocket.Stop();
                                mServerSocketList.remove(rSocket);
                                break;
                            }
                        }
                    }
                });
            }catch (IOException e){
                Log.i("BtConnectorHelper","Creating BtToServerSocket failed : " + e.toString());
                return;
            }
            tmpBtToServerSocket.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);

            mServerSocketList.add(tmpBtToServerSocket);

            tmpBtToServerSocket.SetIdAddressAndName(peerId, peerName, peerAddress);
            tmpBtToServerSocket.setPort(this.mServerPort);
            tmpBtToServerSocket.start();

            int port = tmpBtToServerSocket.GetLocalHostPort();
            Log.i("BtConnectorHelper","Server socket is using : " + port + ", and is now connected.");

            return;
        }

        //not incoming, thus its outgoing
        BtToRequestSocket tmpRequestSocket = null;
        try {
            tmpRequestSocket = new BtToRequestSocket(bluetoothSocket, new BtSocketDisconnectedCallBack() {
                //Called when disconnect event happens, so we can stop & clean everything now.
                @Override
                public void Disconnected(Thread who, String Error) {

                    for (BtToRequestSocket rSocket : mRequestSocketList) {
                        if (rSocket != null && (rSocket.getId() == who.getId())) {
                            Log.i("BtConnectorHelper", "Disconnect outgoing peer: " + rSocket.GetPeerName());
                            mRequestSocketList.remove(rSocket);
                            // fire the event in here !!!
                            rSocket.Stop();
                            JSONObject returnJsonObj = new JSONObject();
                            try {
                                returnJsonObj.put(JXcoreExtension.EVENTVALUESTRING_PEERID, rSocket.GetPeerId());
                            } catch (JSONException e) {
                                Log.i("BtConnectorHelper","JSONException : " + e.toString());
                            }

                            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_CONNECTIONERROR, returnJsonObj.toString());
                            break;
                        }
                    }
                }
            }, new BtToRequestSocket.ReadyForIncoming() {
                // there is a good chance on race condition where the node.js gets to do their client socket
                // before we got into the accept line executed, thus this callback takes care that we are ready before node.js is
                @Override
                public void listeningAndAcceptingNow(int port) {
                    final int portTmp = port;
                    Log.i("BtConnectorHelper","Request socket is using : " + portTmp);
                    new Handler(jxcore.activity.getMainLooper()).postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            ConnectStatusCallback tmpCallBack = mConnectStatusCallback;
                            if (tmpCallBack != null) {
                                Log.i("BtConnectorHelper","Calling ConnectionStatusUpdate with port :" + portTmp);
                                tmpCallBack.ConnectionStatusUpdate(null, portTmp);
                            }
                        }
                    }, 300);
                }
            });
        }catch (IOException e) {
            Log.i("BtConnectorHelper","Creating BtToRequestSocket failed : " + e.toString());
            ConnectStatusCallback tmpCallBack = mConnectStatusCallback;
            if (tmpCallBack != null) {
                tmpCallBack.ConnectionStatusUpdate("Creating BtToRequestSocket failed : " + e.toString(), -1);
            }
            return;
        }

        mRequestSocketList.add(tmpRequestSocket);
        tmpRequestSocket.SetIdAddressAndName(peerId, peerName, peerAddress);

        tmpRequestSocket.setDefaultUncaughtExceptionHandler(mThreadUncaughtExceptionHandler);
        tmpRequestSocket.SetIdAddressAndName(peerId, peerName, peerAddress);
        tmpRequestSocket.start();
    }

    // if the peer that just made incoming connection has not been discovered yet, we'll ad it here
    // thus allowing us to make connection back to it
    private void AddPeerIfNotDiscovered(BluetoothSocket bluetoothSocket, String peerId,String peerName,String peerAddress) {

        boolean isDiscovered = false;

        for (ServiceItem item : lastAvailableList) {
            if (item != null && item.peerId.contentEquals(peerId)) {
                isDiscovered = true;
                break;
            }
        }

        if (!isDiscovered) {
            String BtAddress = peerAddress;
            if (bluetoothSocket != null) {
                if (bluetoothSocket.getRemoteDevice() != null) {
                    BtAddress = bluetoothSocket.getRemoteDevice().getAddress();
                }
            }

            ServiceItem tmpSrv = new ServiceItem(peerId, peerName, BtAddress, "", "", "");
            lastAvailableList.add(tmpSrv);

            JSONArray jsonArray = new JSONArray();
            jsonArray.put(getAvailabilityStatus(tmpSrv, true));
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, jsonArray.toString());
        }
    }


    //this is always called in context of thread that created instance of the library
    @Override
    public void ConnectionFailed(String peerId, String peerName, String peerAddress) {
        ConnectStatusCallback tmpStatBack = mConnectStatusCallback;
        if(tmpStatBack != null) {
            tmpStatBack.ConnectionStatusUpdate("Connection to " + peerId + " failed", -1);
        }
    }

    //this is always called in context of thread that created instance of the library
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
            default:
                throw new RuntimeException("Invalid value set for BTConnector.State in StateChanged");
        }
    }

    // this is called with a full list of peer-services we see, its takes time to get,
    // since there is time spend between each peer we discover
    // anyway, this list can be used for determining whether the peer we saw earlier has now disappeared
    // will be called null or empty list, if no services are found during some time period.

    //this is always called in context of thread that created instance of the library
    @Override
    public ServiceItem CurrentPeersList(final List<ServiceItem> serviceItems) {

   /*     Boolean wasPreviouslyAvailable = false;

        JSONArray jsonArray = new JSONArray();

        if (serviceItems != null) {
            for (ServiceItem item: serviceItems) {
                if(item != null) {
                    wasPreviouslyAvailable = false;

                    for (ServiceItem lastItem : lastAvailableList) {
                        if (lastItem != null && item.deviceAddress.equalsIgnoreCase(lastItem.deviceAddress)) {
                            wasPreviouslyAvailable = true;
                            lastAvailableList.remove(lastItem);
                        }
                    }

                    if (!wasPreviouslyAvailable) {
                        jsonArray.put(getAvailabilityStatus(item, true));
                    }
                }
            }
        }

        for (ServiceItem lastItem2 : lastAvailableList) {
            jsonArray.put(getAvailabilityStatus(lastItem2, false));
            lastAvailableList.remove(lastItem2);
        }

        if (serviceItems != null) {
            for (ServiceItem item: serviceItems) {
                if(item != null) {
                    lastAvailableList.add(item);
                }
            }
        }

        // lets not sent any empty arrays up.
        if (jsonArray.toString().length() > 5) {
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, jsonArray.toString());
        }*/
        return null;
    }


    // this is called when we see a peer, so we can inform the app of its availability right when we see it
    //this is always called in context of thread that created instance of the library
    @Override
    public void PeerDiscovered(ServiceItem serviceItem) {
        boolean wasPrevouslyAvailable = false;

        for (ServiceItem lastItem : lastAvailableList) {
            if (lastItem != null && serviceItem.deviceAddress.equalsIgnoreCase(lastItem.deviceAddress)) {
                wasPrevouslyAvailable = true;
            }
        }

        if (!wasPrevouslyAvailable) {

            lastAvailableList.add(serviceItem);

            JSONArray jsonArray = new JSONArray();
            jsonArray.put(getAvailabilityStatus(serviceItem, true));
            jxcore.CallJSMethod(JXcoreExtension.EVENTSTRING_PEERAVAILABILITY, jsonArray.toString());
        }
    }


    private JSONObject getAvailabilityStatus(ServiceItem item, boolean available) {

        JSONObject returnJsonObj = new JSONObject();
        try {
            returnJsonObj.put(JXcoreExtension.EVENTVALUESTRING_PEERID, item.peerId);
            returnJsonObj.put(JXcoreExtension.EVENTVALUESTRING_PEERNAME, item.peerName);
            returnJsonObj.put(JXcoreExtension.EVENTVALUESTRING_PEERAVAILABLE, available);
        } catch (JSONException e) {
            Log.i("BtConnectorHelper","JSONException : " + e.toString());
        }
        return returnJsonObj;
    }
}
