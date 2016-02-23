/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.content.Context;
import android.net.wifi.WifiManager;
import io.jxcore.node.jxcore.JXcoreCallback;
import java.util.ArrayList;
import android.widget.Toast;

public class JXcoreExtension {
    public final static String EVENT_NAME_PEER_AVAILABILITY_CHANGED = "peerAvailabilityChanged";
    public final static String EVENT_VALUE_PEER_ID = "peerIdentifier";
    public final static String EVENT_VALUE_PEER_NAME = "peerName";
    public final static String EVENT_VALUE_PEER_AVAILABLE = "peerAvailable";

    public final static String EVENT_NAME_CONNECTION_ERROR = "connectionError";

    public final static String EVENT_NAME_NETWORK_CHANGED = "networkChanged";
    public final static String EVENT_VALUE_IS_REACHABLE = "isReachable";
    public final static String EVENT_VALUE_IS_WIFI = "isWiFi";

    public final static String METHOD_NAME_SHOW_TOAST = "ShowToast";
    public final static String METHOD_NAME_GET_BLUETOOTH_ADDRESS = "GetBluetoothAddress";
    public final static String METHOD_NAME_GET_BLUETOOTH_NAME = "GetBluetoothName";
    public final static String METHOD_NAME_RECONNECT_WIFI_AP = "ReconnectWifiAP";
    public final static String METHOD_NAME_IS_BLE_SUPPORTED = "IsBLESupported";

    public final static String METHOD_NAME_START_BROADCASTING = "StartBroadcasting";
    public final static String METHOD_NAME_STOP_BROADCASTING = "StopBroadcasting";

    public final static String METHOD_NAME_CONNECT = "Connect";
    public final static String METHOD_NAME_DISCONNECT = "Disconnect";
    public final static String METHOD_NAME_KILL_ALL_CONNECTIONS = "KillConnection";

    public static void LoadExtensions() {
        final ConnectionHelper mConnectionHelper = new ConnectionHelper();

        jxcore.RegisterMethod(METHOD_NAME_RECONNECT_WIFI_AP, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                WifiManager wifiManager = (WifiManager) jxcore.activity.getBaseContext().getSystemService(Context.WIFI_SERVICE);

                if (wifiManager.reconnect()) {
                    wifiManager.disconnect();

                    if (!wifiManager.reconnect()) {
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

        jxcore.RegisterMethod(METHOD_NAME_GET_BLUETOOTH_ADDRESS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();

                String bluetoothMacAddress = mConnectionHelper.getBluetoothMacAddress();

                if (bluetoothMacAddress == null || bluetoothMacAddress.length() == 0) {
                    args.add("Bluetooth MAC address not known");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                } else {
                    args.add(null);
                    args.add(bluetoothMacAddress);

                    jxcore.CallJSMethod(callbackId, args.toArray());
                }
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_GET_BLUETOOTH_NAME, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                String btNameString = mConnectionHelper.getBluetoothName();

                if (btNameString == null) {
                    args.add("Unable to get the Bluetooth name");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                args.add(null); // All is well
                args.add(btNameString);

                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_IS_BLE_SUPPORTED, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> args = new ArrayList<Object>();

                boolean isBleMultipleAdvertisementSupported = mConnectionHelper.isBleMultipleAdvertisementSupported();

                if (isBleMultipleAdvertisementSupported) {
                    args.add(null); // All is well
                    args.add("Bluetooth LE advertising is supported");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                } else {
                    args.add("Bluetooth LE advertising is not supported");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                }
            }
        });

        jxcore.RegisterMethod(METHOD_NAME_SHOW_TOAST, new JXcoreCallback() {
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


      jxcore.RegisterMethod(METHOD_NAME_START_BROADCASTING, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();

              if (params.size() <= 0) {
                  args.add("Required parameters missing.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              if (mConnectionHelper.isRunning()) {
                  args.add("Already running, not re-starting.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              String peerName = params.get(0).toString();
              int port = (Integer) params.get(1);

              boolean retVal = mConnectionHelper.start(peerName, port);

              String errString = null;

              if (!retVal) {
                  errString = "Either Bluetooth or Wi-Fi Direct not supported on this device";
              }

              //if all is well, the errString is still null in here..
              args.add(errString);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      jxcore.RegisterMethod(METHOD_NAME_STOP_BROADCASTING, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();
              if (!mConnectionHelper.isRunning()) {
                  args.add("Already stopped.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              mConnectionHelper.stop();
              args.add(null);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      jxcore.RegisterMethod(METHOD_NAME_DISCONNECT, new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();
              if(params.size() <= 0) {
                  args.add("Required parameters missing");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              String peerId = params.get(0).toString();
              if(!mConnectionHelper.disconnectOutgoingConnection(peerId)) {
                  args.add("Connection for PeerId: " + peerId + " not  found.");
                  jxcore.CallJSMethod(callbackId, args.toArray());
                  return;
              }

              //all is well, so lets return null
              args.add(null);
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

        jxcore.RegisterMethod(METHOD_NAME_KILL_ALL_CONNECTIONS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();
                if (mConnectionHelper.killAllConnections() == 0) {
                    args.add("No incoming connection to disconnect");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                    return;
                }

                //all is well, so lets return null
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });



      jxcore.RegisterMethod(METHOD_NAME_CONNECT, new JXcoreCallback() {
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
              mConnectionHelper.connect(address, new ConnectionHelper.JxCoreExtensionListener() {
                  @Override
                  public void onConnectionStatusChanged(String message, int port) {
                      ArrayList<Object> args = new ArrayList<Object>();
                      args.add(message);
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