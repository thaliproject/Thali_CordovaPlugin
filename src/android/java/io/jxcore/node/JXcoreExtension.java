// License information is available from LICENSE file

package io.jxcore.node;

import android.content.Context;
import android.content.pm.PackageManager;
import android.net.wifi.WifiManager;
import io.jxcore.node.jxcore.JXcoreCallback;
import java.util.ArrayList;
import android.util.Log;
import android.widget.Toast;

import org.thaliproject.p2p.btconnectorlib.BTConnector;

public class JXcoreExtension {

    public final static String EVENTSTRING_PEERAVAILABILITY   = "peerAvailabilityChanged";
    public final static String EVENTVALUESTRING_PEERID        = "peerIdentifier";
    public final static String EVENTVALUESTRING_PEERNAME      = "peerName";
    public final static String EVENTVALUESTRING_PEERAVAILABLE = "peerAvailable";

    public final static String EVENTSTRING_CONNECTIONERROR    = "connectionError";

    public final static String EVENTSTRING_NETWORKCHANGED     = "networkChanged";
    public final static String EVENTVALUESTRING_REACHABLE     = "isReachable";
    public final static String EVENTVALUESTRING_WIFI          = "isWiFi";

    public final static String METHODSTRING_SHOWTOAST         = "ShowToast";
    public final static String METHODSTRING_GETBTADDRESS      = "GetBluetoothAddress";
    public final static String METHODSTRING_ISBLESUPPORTED   = "IsBLESupported";

    public final static String METHODSTRING_STARTBROADCAST    = "StartBroadcasting";
    public final static String METHODSTRING_STOPBROADCAST     = "StopBroadcasting";

    public final static String METHODSTRING_CONNECTTOPEER     = "Connect";
    public final static String METHODSTRING_DISCONNECTPEER    = "Disconnect";
    public final static String METHODSTRING_KILLCONNECTION    = "KillConnection";

    public static void LoadExtensions() {

      //Jukka's stuff
        final BtConnectorHelper mBtConnectorHelper = new BtConnectorHelper();

        jxcore.RegisterMethod(METHODSTRING_GETBTADDRESS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                String btAddressString = mBtConnectorHelper.GetBluetoothAddress();

                if (btAddressString == null) {
                    args.add("returned Bluetooth address is null");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                //all is well, so lets return null as first argument
                args.add(null);
                args.add(btAddressString);

                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHODSTRING_ISBLESUPPORTED, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                String bleErrorString = mBtConnectorHelper.isBLEAdvertisingSupported();
                if (bleErrorString != null) {
                    args.add(bleErrorString);
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                //all is well, so lets return null as first argument
                args.add(null);
                args.add("BLE is supported");

                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });


        jxcore.RegisterMethod(METHODSTRING_SHOWTOAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();

              if(params.size() <= 0) {
                  args.add("Required parameters missing.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              String message = params.get(0).toString();
              boolean isLong = true;
              if (params.size() == 2) {
                isLong = (Boolean) params.get(1);
              }

              int duration = Toast.LENGTH_SHORT;
              if (isLong) {
                duration = Toast.LENGTH_LONG;
              }

              Toast.makeText(jxcore.activity.getApplicationContext(), message, duration).show();
              args.add(null);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });


      jxcore.RegisterMethod(METHODSTRING_STARTBROADCAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();

              if (params.size() <= 0) {
                  args.add("Required parameters missing.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              if (mBtConnectorHelper.isRunning()) {
                  args.add("Already running, not re-starting.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              String peerName = params.get(0).toString();
              int port = (Integer) params.get(1);

              BTConnector.WifiBtStatus retVal = mBtConnectorHelper.Start(peerName, port);

              String errString = null;
              if (!retVal.isBtOk) {
                  errString = "Bluetooth is not supported on this hardware platform, ";
              } else if (!retVal.isBtEnabled) {
                  errString = "Bluetooth is disabled, ";
              }

              if (!retVal.isWifiOk) {
                  errString = "Wi-Fi Direct is not supported on this hardware platform.";
              } else if (!retVal.isWifiEnabled) {
                  errString = "Wi-Fi is disabled.";
              }

              //if all is well, the errString is still null in here..
              args.add(errString);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      jxcore.RegisterMethod(METHODSTRING_STOPBROADCAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();
              if (!mBtConnectorHelper.isRunning()) {
                  args.add("Already stopped.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              mBtConnectorHelper.Stop();
              args.add(null);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      jxcore.RegisterMethod(METHODSTRING_DISCONNECTPEER, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();
              if(params.size() <= 0) {
                  args.add("Required parameters missing");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              String peerId = params.get(0).toString();
              if(!mBtConnectorHelper.Disconnect(peerId)){
                  args.add("Connection for PeerId: " + peerId + " not  found.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              //all is well, so lets return null
              args.add(null);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

        jxcore.RegisterMethod(METHODSTRING_KILLCONNECTION, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();
                if(!mBtConnectorHelper.DisconnectIncomingConnections()){
                    args.add("No incoming connection to disconnect");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                //all is well, so lets return null
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });



      jxcore.RegisterMethod(METHODSTRING_CONNECTTOPEER, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              final String callbackIdTmp = callbackId;

              ArrayList<Object> args = new ArrayList<Object>();
              if (params.size() <= 0) {
                  args.add("Required parameters missing");
                  jxcore.CallJSMethod(callbackIdTmp, args.toArray());
                  return;
              }

              String address = params.get(0).toString();
              mBtConnectorHelper.BeginConnectPeer(address, new BtConnectorHelper.ConnectStatusCallback() {
                  @Override
                  public void ConnectionStatusUpdate(String Error, int port) {
                      ArrayList<Object> args = new ArrayList<Object>();
                      args.add(Error);
                      args.add(port);
                      jxcore.CallJSMethod(callbackIdTmp, args.toArray());
                  }
              });
          }
      });


      final LifeCycleMonitor mLifeCycleMonitor = new LifeCycleMonitor(new LifeCycleMonitor.onLCEventCallback(){

          @Override
          public void onEvent(String eventString,boolean stopped) {
              jxcore.activity.runOnUiThread(new Runnable(){
                  public void run() {
              //        String reply = "{\"lifecycleevent\":\"" + messageTmp + "\"}";
              //        jxcore.CallJSMethod("onLifeCycleEvent",reply);
                  }
              });

              // todo if we get Postcard fixed on lifecycle handling we should re-enable this
              // now we need to just trust that postcard will shutdown correctly
           /*   if(stopped){
                  mBtConnectorHelper.Stop();
              }*/
          }
      });
      mLifeCycleMonitor.Start();
  }
}