package io.jxcore.node;


import org.thaliproject.p2p.btconnectorlib.PeerProperties;

public class ConnectionData {

    public final PeerProperties peerProperties;
    public final boolean isIncoming;

    public ConnectionData(PeerProperties peerProperties, boolean isIncoming) {
        this.peerProperties = peerProperties;
        this.isIncoming = isIncoming;
    }

    @Override
    public String toString() {
        return "Peer properties: " + peerProperties.toString() + ".\n Is incomming connection: " + isIncoming;
    }
}
