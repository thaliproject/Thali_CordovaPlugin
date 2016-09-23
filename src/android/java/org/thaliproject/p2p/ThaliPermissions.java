/* Copyright (c) 2015 Microsoft Corporation. This software is licensed under the MIT License.
 * See the license file delivered with this project for further information.
 */

package org.thaliproject.p2p;

import org.apache.cordova.*;
import org.json.JSONArray;
import org.json.JSONException;
import android.Manifest;
import android.content.pm.PackageManager;
import android.util.Log;

import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;

/*
 * Beginning in Android 6.0, users grant permissions to apps while the app is
 * running. ThaliPermissions class can be used to check whether the user has
 * granted permission for the application.
 */
public class ThaliPermissions extends CordovaPlugin {

    /**
     * Callback context
     */
    private CallbackContext mCurrentContext = null;

    /**
     * Responses
     * PERMISSION_DENIED: User rejected permission
     * CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED: The Library doesn't support concurrent requests
     */
    private static final String RESPONSE_PERMISSION_DENIED = "PERMISSION_DENIED";
    private static final String RESPONSE_CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED =
        "CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED";

    private static final String TAG = ThaliPermissions.class.getName();
    private static final int REQUEST_CODE = 1;

    private static final HashMap<String, String> Permissions = new HashMap<String, String>();

    static {
        Permissions.put("ACCESS_COARSE_LOCATION", Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    /**
     * Executes the request.
     *
     * @param action          The action to execute.
     * @param data            The arguments for the plugin.
     * @param callbackContext The callback context used when calling back into JavaScript.
     * @return True if the method was found, false if not.
     */
    @Override
    public boolean execute(String action, JSONArray data, CallbackContext callbackContext) throws JSONException {
        Log.i(TAG, "execute: " + action);
        boolean methodFound = false;

        if (action.equals("REQUEST_ACCESS_COARSE_LOCATION")) {
            methodFound = true;

            if (mCurrentContext != null && !mCurrentContext.isFinished()) {
                //For simplicity library doesn't support concurrent requests
                callbackContext.error(RESPONSE_CONCURRENT_PERMISSION_REQUESTS_NOT_SUPPORTED);
            } else {
                mCurrentContext = callbackContext;
                checkPermissionStatus("ACCESS_COARSE_LOCATION");
            }
        } else {
            Log.i(TAG, "Method not found.");
        }

        return methodFound;
    }

    /**
     * Check if the permission is already authorized. If not, make a new permission request.
     *
     * @param permission The name of the permission
     */
    private void checkPermissionStatus(String permission) {

        if (cordova.hasPermission(Permissions.get(permission))) {
            mCurrentContext.success();
        } else {
            cordova.requestPermission(this, REQUEST_CODE, Permissions.get(permission));
        }
    }

    /**
     * Once the user has either approved the permission or not, the result
     * is handled in this callback function
     *
     * @param requestCode  The name of the permission
     * @param permissions  List of permissions
     * @param grantResults List of permission request results
     */
    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions,
                                          int[] grantResults)
        throws JSONException {

        for (int result : grantResults) {
            if (result == PackageManager.PERMISSION_DENIED) {
                mCurrentContext.error(RESPONSE_PERMISSION_DENIED);
                return;
            }
        }

        mCurrentContext.success();
    }
}
