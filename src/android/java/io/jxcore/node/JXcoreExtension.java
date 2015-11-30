// License information is available from LICENSE file

package io.jxcore.node;

import android.content.Context;
import android.net.wifi.WifiManager;
import io.jxcore.node.jxcore.JXcoreCallback;
import java.util.ArrayList;

import android.widget.Toast;

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
        final ConnectorHelper mBtConnectorHelper = new ConnectorHelper();

<<<<<<< HEAD
=======
        jxcore.RegisterMethod(METHODSTRING_RECONNECTWIFIAP, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                WifiManager wifiManager = (WifiManager) jxcore.activity.getBaseContext().getSystemService(Context.WIFI_SERVICE);

                if(wifiManager.reconnect()) {
                    wifiManager.disconnect();
                    if(!wifiManager.reconnect()) {
                        args.add("reconnect returned false");
                        jxcore.CallJSMethod(callbackId, args.toArray());
                        return;
                    }
                }

                //all is well, so lets return null as first argument
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

>>>>>>> Commit to #345: Renamed classes, cleaned up the code and improved logging.
        jxcore.RegisterMethod(METHODSTRING_GETBTADDRESS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                String btAddressString = mBtConnectorHelper.getBluetoothAddress();

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

                String bleErrorString = mBtConnectorHelper.isBleAdvertisingSupported();
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

              boolean retVal = mBtConnectorHelper.start(peerName, port);

              String errString = null;

              if (!retVal) {
                  errString = "Either Bluetooth or Wi-Fi Direct not supported on this device";
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

              mBtConnectorHelper.stop();
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
              if(!mBtConnectorHelper.disconnectOutgoingConnection(peerId)) {
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
                if (mBtConnectorHelper.disconnectAllIncomingConnections() == 0) {
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
              mBtConnectorHelper.connect(address, new ConnectorHelper.JxCoreExtensionListener() {
                  @Override
                  public void onConnectionStatusChanged(String info, int port) {
                      ArrayList<Object> args = new ArrayList<Object>();
                      args.add(info);
                      args.add(port);
                      jxcore.CallJSMethod(callbackIdTmp, args.toArray());
                  }
              });
          }
      });


      final LifeCycleMonitor mLifeCycleMonitor = new LifeCycleMonitor(new LifeCycleMonitor.onLCEventCallback() {

          @Override
          public void onEvent(String eventString,boolean stopped) {
              jxcore.activity.runOnUiThread(new Runnable() {
                  public void run() {
              //        String reply = "{\"lifecycleevent\":\"" + messageTmp + "\"}";
              //        jxcore.CallJSMethod("onLifeCycleEvent",reply);
                  }
              });

              // todo if we get Postcard fixed on lifecycle handling we should re-enable this
              // now we need to just trust that postcard will shutdown correctly
           /*   if(stopped) {
                  mBtConnectorHelper.close();
              }*/
          }
      });
      mLifeCycleMonitor.Start();
  }
}