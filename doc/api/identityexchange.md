# Thali Identity Exchange Protocol

This document contains the basic logic of the Thali Identity Exchange Protocol.

## `peerAvailabilityChanged` Event
1. get peerName which may be a hash of the public key;peer name
2. if peer contains hash;their friendly name, emit new peer with identity exchange friendly name and peer identifier and hash as peer name (peerIdentityExchange)

## `startIdentityExchange(friendlyName, cb)` Method
1. Can only happen one at a time
2. call `ThaliReplicationManager#stop`
3. call `ThaliReplicationManager#start` with hash;my friendly name

## `stopIdentityExchange(cb)` Method
1. If in the middle of change, stop the world and clean up current exchange
2. call `ThaliReplicationManager#stop`
3. call `ThaliReplicationManager#start` with regular hash

## `executeIdentityExchange(peerIdentifier, theirHash, cb)` Method
1. 128 bit nonce created using node crypto `crypto.createHmac('SHA256', crypto.randomBytes(32))` called rnMine
2. Ensure `startIdentityExchange` is started
3. Check if already exchanged IDs if calling `connect`
4. Call `connect` with `peerIdentifier` and if error, call `cb(error)`
5. Take my public key hash and send across the wire POST to exchange identity express endpoint, and if error on their side, call `cb(error)`.
6. wait until other side posts to me with their public key hash
7. Is the hash from step 6 the same as what was passed in?
8. If no match, cb(error(already in exchange, sorry))
9. Calculate whose hash is bigger
	1. - If my hash is smaller,
    		1. - take their hash and my hash and concat to string, do a `crypto.createHmac('SHA256', rnMine)` and update with Buffer(concat) and returns Cb
    		2. - post Cb and public key hash and response should be rnOther
    		3. - post rnMine and my public key hash and response should be 200 - OK
    		4. - take my public key hash, your public key hash, rnMine as a single concat string.  Call crypto.createHmac(‘SHA256’, Buffer(rnOther)
    		5. - call hmac.update(concatenated string)
    		6. - mod the value by 10 ^ 6 which gives a six digit integer and return in cb(null, integer)
	2. - If my hash is larger
  		1. - wait for them to post my Cb express endpoint
  		2. - ensure their hash is the same as you expected, else a 400 status code.  Go back to step 2.1
  		3. - If matches, return rnMine
  		4. - Wait for them to send me rnOther
  		5. - concat pkOther + pkMine crypto.createHmac(‘SHA256’, Buffer(rnOther) and compare to Cb in 2.1.  If no match, under attack, return cb(err)
  		6. - if match, take pkMine + pkOther + rnOther with crypto.createHmac(‘SHA256’, Buffer(rnMine))
      7. - mod by 10^6 and return cb(null, integer)

## Express endpoints

### `/identity/exchange` URL

Used to send my public key hash and verify it on the other side, and then send back the other public key hash.

### `/identity/cb` URL



Postcard App Will subscribe to peerIdentityExchange
Postcard App will call startIdentityExchange
Postcard App will call stopIdentityExchange
