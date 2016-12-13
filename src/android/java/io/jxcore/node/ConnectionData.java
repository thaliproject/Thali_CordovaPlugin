package io.jxcore.node;


import org.thaliproject.p2p.btconnectorlib.PeerProperties;

import java.util.concurrent.atomic.AtomicInteger;

public class ConnectionData {
    public static AtomicInteger INDEX_ID = new AtomicInteger(1);
    public final PeerProperties peerProperties;
    public final int id;
    public final boolean isIncoming;

    public ConnectionData(PeerProperties peerProperties, boolean isIncoming) {
        this.peerProperties = peerProperties;
        this.isIncoming = isIncoming;
        this.id = INDEX_ID.getAndAdd(1);
    }

    @Override
    public String toString() {
        return "Peer properties: " + peerProperties.toString() + ".\n Is incomming connection: " +
            isIncoming + ".\n id: " + id;
    }
}
