// License information is available from LICENSE file

package io.jxcore.node;

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

    public final static String EVENTSTRING_NETWORKCHANGED     = "networkChanged";
    public final static String EVENTVALUESTRING_REACHABLE     = "isReachable";
    public final static String EVENTVALUESTRING_WIFI          = "isWiFi";

    public final static String METHODSTRING_SHOWTOAST         = "ShowToast";

    public final static String METHODSTRING_STARTBROADCAST    = "StartBroadcasting";
    public final static String METHODSTRING_STOPBROADCAST     = "StopBroadcasting";

    public final static String METHODSTRING_CONNECTTOPEER     = "Connect";
    public final static String METHODSTRING_DISCONNECTPEER    = "Disconnect";
    public final static String METHODSTRING_KILLCONNECTION    = "KillConnection";

    public static void LoadExtensions() {

      //Jukka's stuff
      jxcore.RegisterMethod(METHODSTRING_SHOWTOAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();

              if(params.size() > 0) {
                  String message = params.get(0).toString();
                  boolean isLong = true;
                  if (params.size() == 2) {
                      isLong = ((Boolean) params.get(1)).booleanValue();
                  }

                  int duration = Toast.LENGTH_SHORT;
                  if (isLong) {
                      duration = Toast.LENGTH_LONG;
                  }

                  Toast.makeText(jxcore.activity.getApplicationContext(), message, duration).show();
                  args.add(null);
              }else{
                  args.add("Required parameters missing");
              }

              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      final BtConnectorHelper mBtConnectorHelper = new BtConnectorHelper();

      jxcore.RegisterMethod(METHODSTRING_STARTBROADCAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              if(params.size() > 1) {
                  String peerName = params.get(0).toString();
                  String port = params.get(1).toString();

                  String errString = "";
                  ArrayList<Object> args = new ArrayList<Object>();

                  if(!mBtConnectorHelper.isRunning()) {
                      BTConnector.WifiBtStatus retVal = mBtConnectorHelper.Start(peerName, Integer.decode(port));

                      if (retVal.isWifiEnabled && retVal.isWifiOk && retVal.isBtEnabled && retVal.isBtOk) {
                          args.add(null);
                      } else {
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
                          args.add(errString);
                      }
                  }else{
                      errString ="Already running, not re-starting.";
                      args.add(errString);
                  }
                  Log.i("DEBUG-TEST" , METHODSTRING_STARTBROADCAST + "called, we return Err string as : " + errString);
                  jxcore.CallJSMethod(callbackId, args.toArray());
              }
          }
      });

      jxcore.RegisterMethod(METHODSTRING_STOPBROADCAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              String errString = "";
              ArrayList<Object> args = new ArrayList<Object>();
              if (mBtConnectorHelper.isRunning()) {
                  mBtConnectorHelper.Stop();
                  args.add(null);
              } else {
                  errString ="Already stopped.";
                  args.add("Already stopped.");
              }

              Log.i("DEBUG-TEST" , METHODSTRING_STOPBROADCAST + " returning Err  as : " + errString);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      jxcore.RegisterMethod(METHODSTRING_DISCONNECTPEER, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              String peerId = "";
              if(params.size() > 0) {
                  peerId = params.get(0).toString();
              }

              ArrayList<Object> args = new ArrayList<Object>();
              if(mBtConnectorHelper.Disconnect(peerId)){
                  args.add(null);
              }else{
                  args.add("Connection for PeerId: " + peerId + " not  found.");
              }
              jxcore.CallJSMethod(callbackId, args.toArray());

          }
      });

        jxcore.RegisterMethod(METHODSTRING_KILLCONNECTION, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {


                ArrayList<Object> args = new ArrayList<Object>();
                if(mBtConnectorHelper.DisconnectIncomingConnections()){
                    args.add(null);
                }else{
                    args.add("No incoming connection to disconnect");
                }
                jxcore.CallJSMethod(callbackId, args.toArray());

            }
        });



      jxcore.RegisterMethod(METHODSTRING_CONNECTTOPEER, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              final String callbackIdTmp = callbackId;
              if(params.size() > 0) {
                  String address = params.get(0).toString();

                  mBtConnectorHelper.BeginConnectPeer(address, new BtConnectorHelper.ConnectStatusCallback(){
                      @Override
                      public void ConnectionStatusUpdate(String Error, int port) {
                          ArrayList<Object> args = new ArrayList<Object>();
                          args.add(Error);
                          args.add(port);
                          jxcore.CallJSMethod(callbackIdTmp, args.toArray());
                      }
                  });

              }else{
                  ArrayList<Object> args = new ArrayList<Object>();
                  args.add("Required parameters missing");
                  jxcore.CallJSMethod(callbackIdTmp, args.toArray());
              }
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