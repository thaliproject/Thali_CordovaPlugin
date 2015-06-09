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

public class JXcoreExtension {
  public static void LoadExtensions() {

      //Jukka's stuff
      jxcore.RegisterMethod("ShowToast", new JXcoreCallback() {
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
                  args.add("Ok");
              }else{
                  args.add("ERROR");
                  args.add("Required parameters missing");
              }

              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      final BtConnectorHelper mBtConnectorHelper = new BtConnectorHelper();

      jxcore.RegisterMethod("GetDeviceName", new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){
              ArrayList<Object> args = new ArrayList<Object>();
              args.add(mBtConnectorHelper.GetDeviceName());
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });

      jxcore.RegisterMethod("getFreePort", new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){
              ArrayList<Object> args = new ArrayList<Object>();
              args.add(mBtConnectorHelper.getFreePort());
              jxcore.CallJSMethod(callbackId, args.toArray());

          }
      });

      jxcore.RegisterMethod("SetKeyValue", new JXcoreCallback() {
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

      jxcore.RegisterMethod("GetKeyValue", new JXcoreCallback() {
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

      jxcore.RegisterMethod("MakeGUID", new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId){
              ArrayList<Object> args = new ArrayList<Object>();
              args.add(mBtConnectorHelper.MakeGUID());
              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });



      jxcore.RegisterMethod("StartPeerCommunications", new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {
              if(params.size() > 2) {
                  String peerId = params.get(0).toString();
                  String peerName = params.get(1).toString();
                  String port = params.get(2).toString();

                  boolean started = true;
                  mBtConnectorHelper.Start(peerId, peerName,Integer.decode(port));

                  ArrayList<Object> args = new ArrayList<Object>();
                  args.add(started);
                  jxcore.CallJSMethod(callbackId, args.toArray());
              }
          }
      });

      jxcore.RegisterMethod("StopPeerCommunications", new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              mBtConnectorHelper.Stop();
          }
      });

      jxcore.RegisterMethod("DisconnectPeer", new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              String peerId = "";
              if(params.size() > 0) {
                  peerId = params.get(0).toString();
              }
              mBtConnectorHelper.ReStart(peerId);

          }
      });

      jxcore.RegisterMethod("ConnectToDevice", new JXcoreCallback() {
          @Override
          public void Receiver(ArrayList<Object> params, String callbackId) {

              ArrayList<Object> args = new ArrayList<Object>();
              if(params.size() > 0) {
                  String address = params.get(0).toString();
                  if(mBtConnectorHelper.BeginConnectPeer(address)) {
                      args.add("Ok");
                  }else{
                      args.add("ERROR");
                      args.add("Connecting failed");
                  }
              }else{
                  args.add("ERROR");
                  args.add("Required parameters missing");
              }

              jxcore.CallJSMethod(callbackId, args.toArray());
          }
      });


      final LifeCycleMonitor mLifeCycleMonitor = new LifeCycleMonitor(new LifeCycleMonitor.onLCEventCallback(){

          @Override
          public void onEvent(String eventString,boolean stopped) {
              final String messageTmp = eventString;
              jxcore.activity.runOnUiThread(new Runnable(){
                  public void run() {
                      String reply = "{\"lifecycleevent\":\"" + messageTmp + "\"}";
                      jxcore.CallJSMethod("onLifeCycleEvent",reply);
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