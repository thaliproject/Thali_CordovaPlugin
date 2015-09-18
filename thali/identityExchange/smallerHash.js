'use strict';

var StateMachine = require("javascript-state-machine");

var identityExchangeController = null;
var peerIdentifier = null;
var otherPkHash = null;
var myPkHash = null;
var cb = null;

var smallHashStateMachine = StateMachine.create({
    initial: 'none',
    events: [
        { name: 'startSearch', from: 'none', to: 'GetPeerIdPort'},
        { name: 'exitCalled',
            from: ['GetPeerIdPort', 'MakeCbRequest', 'WaitForIdentityExchangeToStart', 'MakeRnMineRequest'],
            to: 'Exit'},
        { name: 'foundPeer', from: 'GetPeerIdPort', to: 'MakeCbRequest'},
        { name: 'identityExchangeNotStarted', from: ['MakeCbRequest', 'MakeRnMineRequest'],
            to: 'WaitForIdentityExchangeToStart'},
        { name: 'cbRequestSucceeded', from: 'MakeCbRequest', to: 'MakeRnMineRequest'},
        { name: 'channelBindingError', from: ['MakeCbRequest, MakeRnMineRequest'], to: 'GetPeerIdPort'}
    ],
    callbacks: {
        onstartSearch: onStartSearch,
        onexitCalled: onExitCalled,
        onfoundPeer: onFoundPeer,
        onidentityExchangeNotStarted: onIdentityExchangeNotStarted,
        oncbRequestSucceeded: onCbRequestSucceeded,
        onchannelBindingError: onChannelBindingError
    }
});

function onStartSearch(event, from, to) {
    getPeerPortId(null);
}

function onExitCalled(event, from, to) {

}

function onFoundPeer(event, from, to) {

}

function onIdentityExchangeNotStarted(event, from, to) {

}

function onCbRequestSucceeded(event, from, to) {

}

function onChannelBindingError(event, from, to) {

}

function getPeerPortId(portLookupTime) {

}

function SmallHashStateMachine(identityExchangeController, peerIdentifier, otherPkHash, myPkHash, cb) {
    this.identityExchangeController = identityExchangeController;
    this.peerIdentifier = peerIdentifier;
    this.otherPkHash = otherPkHash;
    this.myPkHash = myPkHash;
    this.cb = cb;
    smallHashStateMachine.startSearch();
}

module.exports = SmallHashStateMachine;