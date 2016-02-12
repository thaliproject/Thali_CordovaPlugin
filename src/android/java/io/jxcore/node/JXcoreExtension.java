/* Copyright (c) 2015-2016 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */
package io.jxcore.node;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;
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

    //public final static String METHOD_NAME_CONNECT = "Connect";
    public final static String METHOD_NAME_DISCONNECT = "Disconnect";


    public final static String METHOD_NAME_START_LISTENING_FOR_ADVERTISEMENTS = "startListeningForAdvertisements";
    public final static String METHOD_NAME_STOP_LISTENING_FOR_ADVERTISEMENTS = "stopListeningForAdvertisements";
    public final static String METHOD_NAME_START_UPDATE_ADVERTISING_AND_LISTENING = "startUpdateAdvertisingAndListening";
    public final static String METHOD_NAME_STOP_ADVERTISING_AND_LISTENING = "stopAdvertisingAndListening";
    public final static String METHOD_NAME_CONNECT = "connect";
    public final static String METHOD_NAME_KILL_CONNECTIONS = "killConnections";

    public final static String EVENT_PEER_AVAILABILITY_CHANGED = "peerAvailabilityChanged";
    public final static String EVENT_DISCOVERY_ADVERTISING_STATE_UPDATE = "discoveryAdvertisingStateUpdateNonTCP";
    public final static String EVENT_NETWORK_CHANGED = "networkChanged";
    public final static String EVENT_INCOMING_CONNECTION_TO_PORT_NUMBER_FAILED = "incomingConnectionToPortNumberFailed";

    private final static String TAG = JXcoreExtension.class.getName();

    public static void LoadExtensions() {
        final ConnectionHelper mConnectionHelper = new ConnectionHelper();

        /**
         * Please see the definition of
         * {@link module:thaliMobileNativeWrapper.startListeningForAdvertisements}.
         *
         * @public
         * @function external:"Mobile('startListeningForAdvertisements')".callNative
         * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
         */

        /**
         * thaliMobileNativeWrapper.startListeningForAdvertisements:
         * This method instructs the native layer to discover what other devices are
         * within range using the platform's non-TCP P2P capabilities. When a device is
         * discovered its information will be published via {@link
         * event:nonTCPPeerAvailabilityChangedEvent}.
         *
         * This method is idempotent so multiple consecutive calls without an
         * intervening call to stop will not cause a state change.
         *
         * This method MUST NOT be called if the object is not in start state or a "Call
         * Start!" error MUST be returned.
         *
         * | Error String | Description |
         * |--------------|-------------|
         * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
         * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
         * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
         * | Call Start! | The object is not in start state. |
         *
         */

        jxcore.RegisterMethod(METHOD_NAME_START_LISTENING_FOR_ADVERTISEMENTS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                //all is well, so lets return null as first argument
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());



                ArrayList<Object> arguments = new ArrayList<Object>();

                if (params.size() <= 0) {
                    arguments.add("Required parameters missing.");
                    jxcore.CallJSMethod(callbackId, arguments.toArray());
                    return;
                }

                if (mConnectionHelper.isRunning()) {
                    arguments.add("Already running, not re-starting.");
                    jxcore.CallJSMethod(callbackId, arguments.toArray());
                    return;
                }

                String peerName = params.get(0).toString();
                int port = (Integer) params.get(1);

                boolean retVal = mConnectionHelper.start(port);

                String errString = null;

                if (!retVal) {
                    errString = "Either Bluetooth or Wi-Fi Direct not supported on this device";
                }

                //if all is well, the errString is still null in here..
                arguments.add(errString);
                jxcore.CallJSMethod(callbackId, arguments.toArray());
            }
        });

        /**
         * Please see the definition of
         * {@link module:thaliMobileNativeWrapper.stopAdvertisingAndListening}.
         *
         * @public
         * @function external:"Mobile('stopAdvertisingAndListening')".callNative
         * @param {module:thaliMobileNative~ThaliMobileCallback} callback
         */

        /**
         * module:thaliMobileNativeWrapper.stopAdvertisingAndListening:
         * This method instructs the native layer to stop listening for discovery
         * advertisements. Note that so long as discovery isn't occurring (because, for
         * example, the radio needed isn't on) this method will return success.
         *
         * This method is idempotent and MAY be called even if
         * startListeningForAdvertisements has not been called.
         *
         * This method MUST NOT terminate any existing connections created locally using
         * {@link module:thaliMobileNativeWrapper.connect}.
         *
         * | Error String | Description |
         * |--------------|-------------|
         * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
         *
         */

        jxcore.RegisterMethod(METHOD_NAME_STOP_LISTENING_FOR_ADVERTISEMENTS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                //all is well, so lets return null as first argument
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });
        /**
         * Please see the definition of
         * {@link module:thaliMobileNativeWrapper.startUpdateAdvertisingAndListening}.
         *
         * However, in addition to what is written there, when the system receives an
         * incoming connection it will do so by initiating a single TCP/IP connection to
         * the port given below in `portNumber`. If the non-TCP connection from which
         * the content in the TCP/IP connection is sourced should terminate for any
         * reason then the TCP/IP connection MUST also be terminated. If the TCP
         * connection to `portNumber` is terminated for any reason then the associated
         * non-TCP connection MUST be terminated.
         *
         * @public
         * @function external:"Mobile('startUpdateAdvertisingAndListening')".callNative
         * @param {number} portNumber The port on 127.0.0.1 that any incoming
         * connections over the native non-TCP/IP transport should be bridged to.
         * @param {module:thaliMobileNative~ThaliMobileCallback} callback
         */

        /**
         * thaliMobileNativeWrapper.startUpdateAdvertisingAndListening:
         * This method has two separate but related functions. It's first function is to
         * begin advertising the Thali peer's presence to other peers. The second
         * purpose is to accept incoming non-TCP/IP connections (that will then be
         * bridged to TCP/IP) from other peers.
         *
         * In Android these functions can be separated but with iOS the multi-peer
         * connectivity framework is designed such that it is only possible for remote
         * peers to connect to the current peer if and only if the current peer is
         * advertising its presence. So we therefore have put the two functions together
         * into a single method.
         *
         * This method MUST NOT be called unless in the start state otherwise a "Call
         * Start!" error MUST be returned.
         *
         * ## Discovery
         *
         * Thali currently handles discovery by announcing over the discovery channel
         * that the Thali peer has had a state change without providing any additional
         * information, such as who the peer is or who the state changes are relevant
         * to. The remote peers, when they get the state change notification, will have
         * to connect to this peer in order to retrieve information about the state
         * change.
         *
         * Therefore the purpose of this method is just to raise the "state changed"
         * flag. Each time it is called a new event will be generated that will tell
         * listeners that the system has changed state since the last call. Therefore
         * this method is not idempotent since each call causes a state change.
         *
         * Once an advertisement is sent out as a result of calling this method
         * typically any new peers who come in range will be able to retrieve the
         * existing advertisement. So this is not a one time event but rather more of a
         * case of publishing an ongoing advertisement regarding the peer's state.
         *
         * ## Incoming Connections
         *
         * By default all incoming TCP connections generated by {@link
         * external:"Mobile('startUpdateAdvertisingAndListening')".callNative} MUST be
         * passed through a multiplex layer. The details of how this layer works are
         * given in {@link module:TCPServersManager}. This method will pass the port
         * from {@link module:TCPServersManager.start} output to {@link
         * external:"Mobile('startUpdateAdvertisingAndListening')".callNative}.
         *
         * If the TCP connection established by the native layer to the previously
         * specified port is terminated by the server for any reason then the native
         * layer MUST tear down the associated Bluetooth socket or MPCF mcSession.
         *
         * ## Repeated calls
         *
         * By design this method is intended to be called multiple times without calling
         * stop as each call causes the currently notification flag to change.
         *
         * | Error String | Description |
         * |--------------|-------------|
         * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
         * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
         * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
         * | Call Start! | The object is not in start state. |
         *
         * @public
         * @returns {Promise<?Error>}
         */



        jxcore.RegisterMethod(METHOD_NAME_START_UPDATE_ADVERTISING_AND_LISTENING, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                //all is well, so lets return null as first argument
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        /**
         * Please see the definition of
         * {@link module:thaliMobileNativeWrapper.startUpdateAdvertisingAndListening}.
         *
         * However, in addition to what is written there, when the system receives an
         * incoming connection it will do so by initiating a single TCP/IP connection to
         * the port given below in `portNumber`. If the non-TCP connection from which
         * the content in the TCP/IP connection is sourced should terminate for any
         * reason then the TCP/IP connection MUST also be terminated. If the TCP
         * connection to `portNumber` is terminated for any reason then the associated
         * non-TCP connection MUST be terminated.
         *
         * @public
         * @function external:"Mobile('startUpdateAdvertisingAndListening')".callNative
         * @param {number} portNumber The port on 127.0.0.1 that any incoming
         * connections over the native non-TCP/IP transport should be bridged to.
         * @param {module:thaliMobileNative~ThaliMobileCallback} callback
         */

        /**
         * thaliMobileNativeWrapper.startUpdateAdvertisingAndListening:
         * This method tells the native layer to stop advertising the presence of the
         * peer, stop accepting incoming connections over the non-TCP/IP transport and
         * to disconnect all existing non-TCP/IP transport incoming connections.
         *
         * Note that so long as advertising has stopped and there are no incoming
         * connections or the ability to accept them then this method will return
         * success. So, for example, if advertising was never started then this method
         * will return success.
         *
         * | Error String | Description |
         * |--------------|-------------|
         * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
         *
         * @public
         * @returns {Promise<?Error>}
         */
        jxcore.RegisterMethod(METHOD_NAME_STOP_ADVERTISING_AND_LISTENING, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {

                ArrayList<Object> args = new ArrayList<Object>();

                //all is well, so lets return null as first argument
                args.add(null);
                jxcore.CallJSMethod(callbackId, args.toArray());
            }
        });

        /**
         * This method tells the native layer to establish a non-TCP/IP connection to
         * the identified peer and to then create a TCP/IP bridge on top of that
         * connection which can be accessed locally by opening a TCP/IP connection to
         * the port returned in the callback.
         *
         * This method MUST return an error if called while start listening for
         * advertisements is not active. This restriction is really only needed for iOS
         * but we enforce it on Android as well in order to keep the platform
         * consistent.
         *
         * If this method is called consecutively with the same peerIdentifier and a
         * connection is either in progress or already exists then an error MUST
         * be returned. Otherwise a new
         * connection MUST be created.
         *
         * In the case of Android there MUST be at most one
         * Bluetooth client connection between this peer and the identified remote peer.
         * In the case of iOS there MUST be at most one MCSession between this peer and
         * the identified remote peer. In the case of iOS if this peer is lexically
         * smaller than the other peer then the iOS layer MUST try to establish a
         * MCSession with the remote peer as a signaling mechanism per the instructions
         * in the binding spec. If an incoming connection is created within a reasonable
         * time period from the lexically larger peer then the system MUST issue a
         * connect callback with listeningPort set to null and clientPort/serverPort set
         * based on the values used when establishing the incoming connection from the
         * remote peer.
         *
         * The port created by a connect call MUST only accept a single TCP/IP
         * connection at a time. Any subsequent TCP/IP connections to the 127.0.0.1 port
         * MUST be rejected.
         *
         * It is implementation dependent if the non-TCP/IP connection that the
         * 127.0.0.1 port will be bound to is created before the callback is called or
         * only when the TCP/IP port is first connected to.
         *
         * If any of the situations listed below occur then the non-TCP/IP connection
         * MUST be fully closed, the existing connection to the 127.0.0.1 port (if any)
         * MUST be closed and the port MUST be released:
         *
         *  - The TCP/IP connection to the 127.0.0.1 port is closed or half closed
         *  - No connection is made to the 127.0.0.1 port within a fixed period of
         *  time, typically 2 seconds (this only applies on Android and for lexically
         *  larger iOS peers)
         *  - If the non-TCP/IP connection should fail in whole or in part (e.g. some
         *  non-TCP/IP transports have the TCP/IP equivalent of a 1/2 closed connection)
         *
         * A race condition exists that can cause something called a "channel binding
         * problem". This race condition occurs when a callback to this method is
         * received with a port but before the port can be used it gets closed and
         * re-assign to someone else. The conditions under which this occur typically
         * involve interactions with the native system and other parallel
         * threads/processes. But if this happens then the client code can think that a
         * certain port represents a particular peer when it may not.
         *
         * Typically we use TLS to address this problem for connections run on the
         * multiplexer layer that sits on top of the port returned by this method. TLS
         * allows us to authenticate that we are talking with whom we think we are
         * talking. But if TLS can't be used then some equivalent mechanism must be or
         * an impersonation attack becomes possible.
         *
         * | Error String | Description |
         * |--------------|-------------|
         * | Illegal peerID | The peerID has a format that could not have been returned by the local platform |
         * | startListeningForAdvertisements is not active | Go start it! |
         * | Alreading connect(ing/ed) | There already is a connection or a request to create one is already in process |
         * | Connection could not be established | The attempt to connect to the peerID failed. This could be because
         * the peer is gone, no longer accepting connections or the radio stack is just horked. |
         * | Connection wait timed out | This is for the case where we are a lexically smaller peer and the lexically
         * larger peer doesn't establish a connection within a reasonable period of time. |
         * | Max connections reached | The native layers have practical limits on how many connections they can handle
         * at once. If that limit has been reached then this error is returned. The only action to take is to wait for
         * an existing connection to be closed before retrying.  |
         * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
         * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
         * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
         *
         * @public
         * @function external:"Mobile('connect')".callNative
         * @param {string} peerIdentifier
         * @param {module:thaliMobileNative~ConnectCallback} callback Returns an
         * error or the 127.0.0.1 port to connect to in order to get a connection to the
         * remote peer
         */

        jxcore.RegisterMethod(METHOD_NAME_CONNECT, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, final String callbackId) {
                if (params.size() == 0) {
                    ArrayList<Object> args = new ArrayList<Object>();
                    args.add("Required parameter, {string} peerIdentifier, missing");
                    jxcore.CallJSMethod(callbackId, args.toArray());
                } else {
                    String address = params.get(0).toString();

                    mConnectionHelper.connect(address, new ConnectionHelper.JxCoreExtensionListener() {
                        @Override
                        public void onConnectionStatusChanged(String message, int port) {
                            ArrayList<Object> args = new ArrayList<Object>();
                            args.add(message);
                            args.add(port);
                            jxcore.CallJSMethod(callbackId, args.toArray());
                        }
                    });
                }
            }
        });

        /**
         * Please see the definition of
         * {@link module:thaliMobileNativeWrapper.killConnections}.
         *
         * @private
         * @function external:"Mobile('killConnections')".callNative
         * @param {module:thaliMobileNative~ThaliMobileCallback} callback
         */

        /**
         * thaliMobileNativeWrapper.killConnections
         * # WARNING: This method is intended for internal Thali testing only. DO NOT
         * USE!
         *
         * This method is only intended for iOS. It's job is to terminate all incoming
         * and outgoing multipeer connectivity framework browser, advertiser, MCSession
         * and stream connections immediately without using the normal stop and start
         * interfaces or TCP/IP level connections. The goal is to simulate what would
         * happen if we switched the phone to something like airplane mode. This
         * simulates what would happen if peers went out of range.
         *
         * This method MUST return "Not Supported" if called on Android. On Android we
         * can get this functionality by using JXCore's ability to disable the local
         * radios.
         *
         * | Error String | Description |
         * |--------------|-------------|
         * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
         * | Not Supported | This method is not support on this platform. |
         *
         */

        jxcore.RegisterMethod(METHOD_NAME_KILL_CONNECTIONS, new JXcoreCallback() {
            @Override
            public void Receiver(ArrayList<Object> params, String callbackId) {
                ArrayList<Object> arguments = new ArrayList<Object>();

                if (mConnectionHelper.killAllConnections() == 0) {
                    // We had no connections to kill, but this is not an error
                    Log.d(TAG, METHOD_NAME_KILL_CONNECTIONS + ": No connections to kill");
                }

                arguments.add(null);
                jxcore.CallJSMethod(callbackId, arguments.toArray());
            }
        });

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

              boolean retVal = mConnectionHelper.start(port);

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