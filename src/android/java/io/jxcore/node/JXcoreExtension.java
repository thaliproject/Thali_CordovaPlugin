// License information is available from LICENSE file

package io.jxcore.node;

import io.jxcore.node.jxcore.JXcoreCallback;
import java.util.ArrayList;
import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Point;
import android.provider.Settings.SettingNotFoundException;
import android.view.Display;
import android.view.WindowManager;
import android.widget.Toast;

import org.thaliproject.p2p.btconnectorlib.BTConnector;

public class JXcoreExtension {

    /*Jukka's debug event -- start*/
    public static String EVENTSTRING_INCOMINGCONNECTION = "GotIncomingConnection";
    /*Jukka's debug event -- end*/

    public static String EVENTSTRING_PEERAVAILABILITY   = "peerAvailabilityChanged";
    public static String EVENTVALUESTRING_PEERID        = "peerIdentifier";
    public static String EVENTVALUESTRING_PEERNAME      = "peerName";
    public static String EVENTVALUESTRING_PEERAVAILABLE = "peerAvailable";

    public static String EVENTSTRING_NETWORKCHANGED     = "networkChanged";
    public static String EVENTVALUESTRING_REACHABLE     = "isReachable";
    public static String EVENTVALUESTRING_WIFI          = "isWiFi";

    public static String METHODSTRING_SHOWTOAST         = "ShowToast";
    public static String METHODSTRING_GETDEVICENAME     = "GetDeviceName";
    public static String METHODSTRING_SETDEVICENAME     = "SetDeviceName";

    public static String METHODSTRING_GETFREEPORT       = "GetFreePort";
    public static String METHODSTRING_SETKEYVALUE       = "SetKeyValue";
    public static String METHODSTRING_GETKEYVALUE       = "GetKeyValue";
    public static String METHODSTRING_MAKEGUID          = "MakeGUID";

    public static String METHODSTRING_STARTBROADCAST    = "StartBroadcasting";
    public static String METHODSTRING_STOPBROADCAST     = "StopBroadcasting";

    public static String METHODSTRING_CONNECTTOPEER     = "Connect";
    public static String METHODSTRING_DISCONNECTPEER    = "Disconnect";

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

      jxcore.RegisterMethod(METHODSTRING_GETDEVICENAME, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){
              ArrayList<Object> args = new ArrayList<Object>();
              args.add(mBtConnectorHelper.GetDeviceName());
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      jxcore.RegisterMethod(METHODSTRING_SETDEVICENAME, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();
                boolean saved = false;
                if (params.size() > 1) {
                    String name = params.get(0).toString();
                    saved = mBtConnectorHelper.SetDeviceName(name);
                }
                args.add(saved);
                jxcore.CallJSMethod(callbackId, args.toArray());

            }
      });

      jxcore.RegisterMethod(METHODSTRING_GETFREEPORT, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){
              ArrayList<Object> args = new ArrayList<Object>();
              args.add(mBtConnectorHelper.getFreePort());
              jxcore.CallJSMethod(callbackId, args.toArray());

          }
      });

      jxcore.RegisterMethod(METHODSTRING_SETKEYVALUE, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){

              if(params.size() > 1) {
                  String key = params.get(0).toString();
                  String value = params.get(1).toString();

                  boolean saved = true;
                  mBtConnectorHelper.SetKeyValue(key, value);

                  ArrayList<Object> args = new ArrayList<Object>();
                  args.add(saved);
                  jxcore.CallJSMethod(callbackId, args.toArray());
              }
          }
      });

      jxcore.RegisterMethod(METHODSTRING_GETKEYVALUE, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){
              if(params.size() > 0) {
                  String key = params.get(0).toString();
                  String value = mBtConnectorHelper.GetKeyValue(key);

                  ArrayList<Object> args = new ArrayList<Object>();
                  if (value != null) {
                      args.add(value);
                  }
                  jxcore.CallJSMethod(callbackId, args.toArray());
              }
          }
      });

      jxcore.RegisterMethod(METHODSTRING_MAKEGUID, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){
              ArrayList<Object> args = new ArrayList<Object>();
              args.add(mBtConnectorHelper.MakeGUID());
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });



      jxcore.RegisterMethod(METHODSTRING_STARTBROADCAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {
              if(params.size() > 2) {
                  String peerId = params.get(0).toString();
                  String peerName = params.get(1).toString();
                  String port = params.get(2).toString();

                  boolean started = true;
                  BTConnector.WifiBtStatus retVal = mBtConnectorHelper.Start(peerId, peerName, Integer.decode(port));

                  ArrayList<Object> args = new ArrayList<Object>();
                  if(retVal.isWifiEnabled && retVal.isWifiOk
                  && retVal.isBtEnabled && retVal.isBtOk) {
                      args.add(null);
                  }else {
                      String errString = "";
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
                  jxcore.CallJSMethod(callbackId, args.toArray());
              }
          }
      });

      jxcore.RegisterMethod(METHODSTRING_STOPBROADCAST, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {
              mBtConnectorHelper.Stop();
              // todo do I really need to call this with null to inform that all is ok ?
              ArrayList<Object> args = new ArrayList<Object>();
              args.add(null);
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
              final String messageTmp = eventString;
              jxcore.activity.runOnUiThread(new Runnable(){
                  public void run() {
              //        String reply = "{\"lifecycleevent\":\"" + messageTmp + "\"}";
              //        jxcore.CallJSMethod("onLifeCycleEvent",reply);
                  }
              });

              if(stopped){
                  mBtConnectorHelper.Stop();
              }
          }
      });
      mLifeCycleMonitor.Start();
  }
}