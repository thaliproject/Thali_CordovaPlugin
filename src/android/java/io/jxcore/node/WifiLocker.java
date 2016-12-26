package io.jxcore.node;

import android.net.wifi.WifiManager;

/**
 * Created by evabishchevich on 12/14/16.
 */

class WifiLocker {

    private static final String LOCK_TAG = "io.jxcore.node.WifiLocker.LOCK_TAG";
    private WifiManager.MulticastLock multicastLock;

    String acquireLock(WifiManager wifiManager) {
        String error = null;
        try {
            if (multicastLock == null) {
                multicastLock = wifiManager.createMulticastLock(LOCK_TAG);
                multicastLock.setReferenceCounted(false);
            }
            if (!multicastLock.isHeld()) {
                multicastLock.acquire();
            }
        } catch (Exception e) {
            error = e.getMessage();
        }
        return error;
    }

    void releaseLock() {
        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
        }
    }
}
