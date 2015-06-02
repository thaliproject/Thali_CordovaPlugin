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
    BtConnectedThread mBTConnectedThread = null;

    String myPeerIdentifier= "";
    String myPeerName = "";

    public BtConnectorHelper() {
        conSettings = new BTConnectorSettings();
        conSettings.SERVICE_TYPE = serviceTypeIdentifier;
        conSettings.MY_UUID = UUID.fromString(BtUUID);
        conSettings.MY_NAME = Bt_NAME;


        this.context = jxcore.activity.getBaseContext();
    }

    public void Start(String peerIdentifier, String peerName){
        this.myPeerIdentifier= peerIdentifier;
        this.myPeerName = peerName;
        this.lastAvailableList.clear();
        Stop();
        mBTConnector = new BTConnector(context,this,this,conSettings,instanceEncryptionPWD);
        mBTConnector.Start(this.myPeerIdentifier,this.myPeerName);
    }

    public void Stop(){
        if(mBTConnector != null){
            mBTConnector.Stop();
            mBTConnector = null;
        }

        Disconnect("");
    }

    public boolean Disconnect(String peerId){
        boolean ret = false;
        if (mBTConnectedThread != null) {
            String currentpeerId = mBTConnectedThread.GetPeerId();
            if(peerId.length() == 0 || peerId.equalsIgnoreCase(currentpeerId)) {
                mBTConnectedThread.Stop();
                mBTConnectedThread = null;
                ArrayList<Object> args = new ArrayList<Object>();
                args.add(currentpeerId);
                jxcore.CallJSMethod("peerNotConnected", args.toArray());
                ret = true;
            }
        }
        return ret;
    }

    public void ReStart(){
        Stop();
        mBTConnector = new BTConnector(context,this,this,conSettings,instanceEncryptionPWD);
        mBTConnector.Start(this.myPeerIdentifier,this.myPeerName);
    }

    public String GetDeviceName(){

        String ret= "";
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        if(bluetooth != null){
            ret = bluetooth.getName();
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


    public boolean BeginConnectPeer(String toPeerId) {

        boolean ret = false;
        ServiceItem selectedDevice = null;
        if (lastAvailableList != null) {
            for (int i = 0; i < lastAvailableList.size(); i++) {
                if (lastAvailableList.get(i).peerId.contentEquals(toPeerId)) {
                    selectedDevice = lastAvailableList.get(i);
                    break;
                }
            }
        }

        String peerId = toPeerId;
        if(selectedDevice != null){
            peerId = selectedDevice.peerId;
        }

        ArrayList<Object> args = new ArrayList<Object>();
        args.add(peerId);

        if (selectedDevice != null && mBTConnector != null  && mBTConnector.TryConnect(selectedDevice)) {
            // we are ok, and status-callback will be delivering the events.
            jxcore.CallJSMethod("peerConnecting", args.toArray());
            ret = true;
        } else {
            jxcore.CallJSMethod("peerNotConnected", args.toArray());
        }

        return ret;
    }

    public boolean SendMessage(String message) {
        boolean ret = false;

        if (mBTConnectedThread != null) {
            mBTConnectedThread.write(message.getBytes());
            ret = true;
        }

        return ret;
    }
    @Override
    public void Connected(BluetoothSocket bluetoothSocket, boolean incoming,String peerId,String peerName,String peerAddress) {

        AddPeerIfNotDiscovered(bluetoothSocket,peerId,peerName,peerAddress);

        ArrayList<Object> args = new ArrayList<Object>();
        args.add(peerId);
        jxcore.CallJSMethod("peerConnected", args.toArray());

        if (mBTConnectedThread != null) {
            mBTConnectedThread.Stop();
            mBTConnectedThread = null;
        }

        mBTConnectedThread = new BtConnectedThread(bluetoothSocket,mHandler,peerId,peerName,peerAddress);
        mBTConnectedThread.start();
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
            ServiceItem tmpSrv = new ServiceItem(peerId,peerName,peerAddress, "", "","");
            lastAvailableList.add(tmpSrv);

            String reply = "[";
            reply = reply + getAvailabilityStatus(tmpSrv, true);
            reply = reply +"]";
            jxcore.CallJSMethod("peerChanged", reply);
        }
    }

    @Override
    public void ConnectionFailed(String peerId, String peerName, String peerAddress) {
        ArrayList<Object> args = new ArrayList<Object>();
        args.add(peerId);
        jxcore.CallJSMethod("peerNotConnected", args.toArray());
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

    // this is called with a fulllist of peer-services we see, its takes time to get,
    // since there is time spend between each peer we discover
    // anyway, this list can be sued for determioning whether the peer we saw earlier has now disappeared
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
            jxcore.CallJSMethod("peerChanged", reply);
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
            jxcore.CallJSMethod("peerAvailabilityChanged", stateReply);
        }
    }

    /*
        {
            "peerIdentifier": "F50F4805-A2AB-4249-9E2F-4AF7420DF5C7",
            "peerName": "Her Phone",
            "state": "Available"
        }
    */
    private String getAvailabilityStatus(ServiceItem item, boolean available) {
        String reply = "";
        if(item != null) {
            reply = "{\"peerIdentifier\":\"" + item.peerId + "\", " + "\"peerName\":\"" + item.peerName + "\", " + "\"peerAvailable\":\"" + available + "\"}";
        }
        return reply;
    }

    private String getStatusItem(String peerId, String peerName, String state) {
        String reply = "";
        reply = "{\"peerIdentifier\":\"" + peerId + "\", " + "\"peerName\":\"" + peerName + "\", " + "\"state\":\"" + state + "\"}";
        return reply;
    }

        // The Handler that gets information back from the BluetoothChatService
    private final Handler mHandler = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch (msg.what) {
                case BtConnectedThread.MESSAGE_WRITE:
                {
                    byte[] writeBuf = (byte[]) msg.obj;// construct a string from the buffer
                    String writeMessage = new String(writeBuf);

                    String reply = "{ \"writeMessage\": \"" + writeMessage + "\"}";
                    jxcore.CallJSMethod("OnMessagingEvent", reply);
                }
                break;
                case BtConnectedThread.MESSAGE_READ:
                {
                    byte[] readBuf = (byte[]) msg.obj;// construct a string from the valid bytes in the buffer
                    String readMessage = new String(readBuf, 0, msg.arg1);

                    String reply = "{ \"readMessage\": \"" + readMessage + "\"}";
                    jxcore.CallJSMethod("OnMessagingEvent", reply);
                }
                break;
                case BtConnectedThread.SOCKET_DISCONNEDTED: {

                    if (mBTConnectedThread != null) {
                        String peerId = mBTConnectedThread.GetPeerId();
                        mBTConnectedThread.Stop();
                        mBTConnectedThread = null;
                        ArrayList<Object> args = new ArrayList<Object>();
                        args.add(peerId);
                        jxcore.CallJSMethod("peerNotConnected", args.toArray());
                    }

                    if(mBTConnector != null) {
                        ReStart();
                    }
                }
                break;
            }
        }
    };
}
