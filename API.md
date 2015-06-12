# Thali API's
This document contains information about Thali API's.

---

## Native API Functions Exposed to JavaScript Code
The following section contains Native API's that are exposed to JavaScript code.

---
`GetDeviceName()`  
*This is an optional API function that is used for scaffolding on iOS at this time.*

*Description:*

Gets the device name.

*Params:* 

None.

*Returns:*

`string`  
The device name.

*Notes:*

On iOS, this returns `[[UIDevice currentDevice] name]`.

---
`MakeGUID()`  
*This is an optional API function that is used for scaffolding on iOS at this time.*

*Description:*

Returns a new GUID.

*Params:* 

None.

*Returns:*

`string`  
The new GUID.

*Notes:*

On iOS, this returns `[[NSUUID UUID] UUIDString]`.

---
`GetKeyValue(key)`  
*This is an optional API function that is used for scaffolding on iOS at this time.*

*Description:*

Gets the value of the specified key.

*Params:* 

`key`  
`string` - The key to get.

*Returns:*

`string`  
The key value, if successful; otherwise, `undefined`.

*Notes:*

None.

---
`SetKeyValue(key, value)`  
*This is an optional API function that is used for scaffolding on iOS at this time.*

*Description:*

Sets the value of the specified key.

*Params:* 

`key`
`string` - The key to set.

`value`
`string` - The value for the key.

*Returns:*

`string`  
The key value, if successful; otherwise, `undefined`.

*Notes:*

None.

---
`NotifyUser(title, message)`

*Description:*

Notifies the user in an operating system specific way.

*Params:* 

`title`  
`string` - Specifies the title.

`message`  
`string` - Specifies the message.

*Returns:*

`boolean`  
`true` if successfull; otherwise, `false`.

*Notes:* 

On iOS, this results in a UILocalNotification when the application is in the background.
If the application is in the foreground, nothing happens and the function returns true.

---
`StartPeerCommunications(peerIdentifier, peerName)`

*Description:*

Starts peer communications.

*Params:* 

`peerIdentifier`  
`string` - Specifies the peer identifier. The `peerIdentifier` uniquely identifies a peer to
other peers. 

Example:

> BEEFCAFE-BEEF-CAFE-BEEF-CAFEBEEFCAFE

`peerName`  
`string` - Specifies the peer name. The `peerName` should be a short name describing the peer.
it is used for debugging and trans purposes.

*Returns:*

`boolean`  
`true` if successfull; otherwise, `false`.


*Notes:* 

For iOS this means we turn on BTLE advertisement and scanning. It also means that we
start the Multipeer Connectivity Framework Advertiser and Browser.

Other platforms will use other techniques.

---
`StopPeerCommunications()`  

*Description:*   

Stops peer communications. 

*Params:* 

None.

*Returns:*

None. 

*Notes:* 

For iOS this means we turn off BTLE advertisement and scanning. It also means that we
stop the Multipeer Connectivity Framework Advertiser and Browser.

Other platforms will use other techniques.

---
`boolean BeginConnectToPeerServer(peerIdentifier)`  

*Description:*   

Begins an attempt to connect to the peer server with the specified peer identifier.

*Params:* 

`peerIdentifier`  
`string` - Specifies the peer identifier.

*Returns:*

`boolean`  
`true` if a connection attempt was successfully started; otherwise, `false`.

*Notes:* 

Upon successful return, the underlying system will attempt to connect to the peer server 
with the specified peer identifier. 

The `connectingToPeerServer`, `connectedToPeerServer`, and `notConnectedToPeerServer` callbacks will
be called as the state of a peer server connection changes. See below.

---
`boolean DisconnectFromPeerServer(peerIdentifier)`

*Description:*   

Disconnect from the peer server with the specified peer identifier.

*Params:* 

`peerIdentifier`  
`string` - Specifies the peer identifier.

*Returns:*

`boolean`  
`true` if the connection was disconnected; otherwise, `false`.

*Notes:* 

The `notConnectedToPeerServer` callback will be called when the state of a peer server connection 
changes. See below.

---
## JavaScript Callbacks Called from Native Code
The following section contains JaavScript callbacks that are called by native code.

---
`networkChanged(network)`

*Description:*   

Called whenever a network change occurs.

*Params:*

`network`  
`object` - JSON object containing the following properties:

>`isReachable`  
>`boolean` - A value which indicates whether the network is currently reachable.
>
>`isWiFi`  
>`boolean` - A value that indicates whether the network is currently reachable via Wi-Fi. This property may be omitted when the `isReachable` property is false.

Examples:

```
{
  "isReachable": true,
  "isWiFi": true
}

{
  "isReachable": false
}
```

---
`​peerAvailabilityChanged(peers)`

*Description:*   

Called whenever the availability of a peer changes.

*Params:*

`peers`  
`array` - A JSON array containing a `peer` object for each peer.

Each `peer` object contains the following properties:

>`peerIdentifier`  
>`string` - The peer identifier.
>
>`peerName`  
>`string` - The peer name.
>
>`peerAvailable`  
>`boolean` - A value which indicates whether the peer is available.
>>
>>`false`  
>>The peer is unavailable. Calling `BeginConnectToPeerServer` will fail.
>>
>>`true`  
>>The peer is available. Calling `BeginConnectToPeerServer` may succeed.
>
>Examples:
>
>```
>[{
>  "peerIdentifier": "F50F4805-A2AB-4249-9E2F-4AF7420DF5C7",
>  "peerName": "Her Phone",
>  "peerAvailable": true
>},
{
>  "peerIdentifier": "1B378E14-0B99-4E16-8275-562AF66BE8D9",
>  "peerName": "His Phone",
>  "peerAvailable": false
>}]
>```

*Returns:*

None. 

*Notes:* 

When a peer is first discovered, `​peerAvailabilityChanged` is called. Each time the availability of a
peer changes, `​peerAvailabilityChanged` will be called to notify the application of the change.

On some systems, `​peerAvailabilityChanged` will be called immediately when the availability of a peer
changes. On other systems, where polling is being used to detect the state of nearby peers, there
may be a significant period of time between `​peerAvailabilityChanged` callbacks.

---
`connectingToPeerServer(peerIdentifier)`

*Description:*   

Called to indicate that a connection to the specified peer server is being established.

*Params:*

`peerIdentifier`  
`string` - The peer identifier.

*Returns:*

None. 

*Notes:* 

None.

---
`connectedToPeerServer(peerIdentifier)`

*Description:*   

Called to indicate that a connection to the specified peer server has been established.

*Params:*

`peerIdentifier`  
`string` - The peer identifier of the peer server.

*Returns:*

None. 

*Notes:* 

None.

---
`notConnectedToPeerServer(peerIdentifier)`

*Description:*   

Called to indicate that a connection to the specified peer server could not be established or was closed.

*Params:*

`peerIdentifier`  
`string` - The peer identifier of the peer server.

*Returns:*

None. 

*Notes:* 

None.

---
`peerClientConnecting(peerIdentifier)`

*Description:*   

Called to indicate that a peer client is connecting.

*Params:*

`peerIdentifier`  
`string` - The peer identifier of the peer client.

*Returns:*

None. 

*Notes:* 

None.

---
`peerClientConnected(peerIdentifier)`

*Description:*   

Called to indicate that a peer client has connected.

*Params:*

`peerIdentifier`  
`string` - The peer identifier of the peer client.

*Returns:*

None. 

*Notes:* 

None.

---
`peerClientNotConnected(peerIdentifier)`

*Description:*   

Called to indicate that a peer client is not connected.

*Params:*

`peerIdentifier`  
`string` - The peer identifier of the peer client.

*Returns:*

None. 

*Notes:* 

None.

---
End of document.