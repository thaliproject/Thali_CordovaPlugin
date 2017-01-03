package io.jxcore.node;

import org.thaliproject.p2p.btconnectorlib.PeerProperties;

/**
 * Created by evabishchevich on 1/3/17.
 */

public interface SurroundingStateObserver {


    void notifyPeerAvailabilityChanged(PeerProperties peerProperties, boolean isAvailable);

    void notifyDiscoveryAdvertisingStateUpdateNonTcp(boolean isDiscoveryActive, boolean isAdvertisingActive);

    /**
     * @param isBluetoothEnabled If true, Bluetooth is enabled. False otherwise.
     * @param isWifiEnabled      If true, Wi-Fi is enabled. False otherwise.
     * @param bssidName          If null this value indicates that either wifiRadioOn is not 'on' or
     *                           that the Wi-Fi isn't currently connected to an access point.
     *                           If non-null then this is the BSSID of the access point that Wi-Fi
     *                           is connected to.
     */
    void notifyNetworkChanged(boolean isBluetoothEnabled, boolean isWifiEnabled, String bssidName, String ssidName);

    /**
     * This event is guaranteed to be not sent more often than every 100 ms.
     *
     * @param portNumber The 127.0.0.1 port that the TCP/IP bridge tried to connect to.
     */
    void notifyIncomingConnectionToPortNumberFailed(int portNumber);
}
