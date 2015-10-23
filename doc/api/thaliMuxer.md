# Muxing TCP/IP connections over non-TCP/IP transports

## The problem

When we use a transport that doesn’t natively support TCP/IP we will create a TCP/IP connection over the transport. But in each case we support exactly one TCP/IP connection at a time over the non-TCP/IP transport. In practice this is a problem because we use HTTP and HTTP really wants to open multiple simultaneous TCP/IP connections at a time. This is necessary due to the fact that most HTTP clients and servers don’t properly implement pipelining and even if they did non-idempotent requests can’t be pipelined. Also without multiple simultaneous TCP/IP connections it is possible to end up with ‘head of line’ blocker situations where a bunch of requests that could have been run in parallel can’t because some expensive request is being processed and HTTP doesn’t support out of order responses.

## Client Solution overview

In an ideal world we would run something like HTTP/2.0 over the Singleton TCP/IP connection. Unlike HTTP/1.1, HTTP/2.0 natively supports parallel requests and responses over a single TCP/IP connection. But the HTTP/2.0 server and client code bases are still a bit early and we don’t feel comfortable adopting them yet.

So instead we use a multiplex layer where we take multiple TCP/IP connections and multiplex them onto a single TCP/IP connection which we then send over the non-TCP/IP transport.

```
                                           -----------------
    TCP/IP Client 1 ---(Connection 1.1)--->|               |
                    ---(Connection 1.2)--->|               |
                         ...               |  Client       |
                    ---(Connection 1.N)--->|  Multiplexer  |
       ...                                 |               |----->Singleton TCP/IP 
    TCP/IP Client N ---(Connection N.1)--->|               |
                         ...               |               |
                    ---(Connection N.N)--->|               |
                                           -----------------
```

In other words any number of TCP/IP clients can form as many TCP/IP connections as they want all of which go to the Multiplexer layer who multiplexes all of those connections into a single TCP/IP connection that is then sent over the Singleton TCP/IP connection that relays to the non-TCP/IP transport. This way we can still have just one TCP/IP connection talking to the non-TCP/IP transport but send over it as many individual TCP/IP connections as we require.

## The Client Multiplexer

To understand the Multiplexer one has to understand the Mobile API layer. This layer emits events that include something called the `peerID` which tells the higher level code that a Thali peer has been found and if one wants to connect to them the one has to instruct the Multiplexer to create a connection.

So everything starts with a Multiplexer.connect(peerID) call. This will cause the Multiplexer to use the Mobile API to establish a Singleton TCP/IP connection with the desired peer. This Singleton TCP/IP connection is actually a TCP/IP listener. That is, it waits for input on its input stream and returns any data is receives from the remote peer over the output stream.

To understand what is happening we need a little nomenclature. We need to explain which connections connect where. To this end we give each connection a name of the form: Component-Protocol

Our components are: 
* _TCP/IP Client X_ - which represents one of the many TCP/IP connections established by the application software using the multiplexer layer.
* _Multiplexer_ - which represents the Multiplexer layer
* _TCP/IP Singleton_ - which represents the TCP/IP Singleton listener which is used to communicate TCP/IP over the non-TCP/IP transport

The protocol identifies what protocol is being used. There are actually two choices, TCP/IP and node.js streams represented by 'T' and 'N'. Right now we are only using TCP/IP but in a few paragraphs that will change.

```
TCP/IP Client X-T <-->
Multiplexer-T <-->
TCP/IP Singleton-T <-->
Native Layer
```

So a bunch of TCP/IP Client connections get created. They are terminated on a listener provided by the Multiplexer layer who then muxes all the incoming connections together onto a single TCP/IP client connection which is then transmitted to the TCP/IP Singleton listener which then transfers the single TCP/IP connection over the native layer.

The key here is how the multiplexer is implemented. For that we use a NPM library called [multiplex](https://github.com/maxogden/multiplex).

This library has been a huge blessing to us as it handles multiplexing many connections down to one connection. But there is a problem and it introduces quite a bit of complexity. The problem is that multiplex doesn't understand TCP/IP. Instead what it understands are node.js streams. What it literally does is take node.js readable and writeable streams and multiplex them together into a single node.js readable and writeable stream.

To simplify our terminology we are going to refer to readable and writeable streams as output and input streams. This will unify our terminology with TCP/IP.

So we have to introduce a new comment, the TCP/IP Multiplexer to work around this limitation.

## The TCP/IP Client Multiplexer




So instead we have come up with a solution so incredibly complex that I still haven’t figured out how to explain it without making my own nose bleed.

The core of the idea is multi-plexing. We take a bunch of independent TCP/IP connections, we multiplex them onto a single TCP/IP connection and we send that data across the Singleton TCP/IP connection supported by the non-TCP/IP transport. When the multiplexed data pops out the other end we demultiplex it into a bunch of independent TCP/IP connections that then connect to whatever port we were told to connect to during configuration.

So multiplex in, multiplex out and we’re done.

In practice however the details are much more complex. The reason is that we use a library called [multiplex](https://github.com/maxogden/multiplex)to implement our multiplexing and that library knows nothing about TCP/IP. What it knows about are node.js streams. Here is an example of how mind numbingly complex this gets in practice.

Imagine we have a HTTP client that wants to make a GET request from Thali Device A to Thali Device B. Because we are talking TCP/IP we can talk about a Client Device and Server Device. The Client Device is the Thali device that established the TCP/IP connection and the Server Device is the Thali device that terminates the connection.

So now lets meet the players in our little drama.

*HTTP Client* - This is the HTTP client on the client device that wants to talk to the server device.

*Mux Listener* - This is a TCP/IP listener running on the client device that the HTTP Client will open connections against. Whenever someone connects to Mux Listener-T a TCP/IP connection on port X (where the value of X changes for each and every TCP/IP connection) is created. Whenever the Mux Listener creates a TCP/IP connection it will also create a node.js input and output stream pair. It will then “cross the streams”. That is, it will take the output stream from the TCP/IP connection and connect to the input stream from the node.js pair and connection the input stream from the TCP/IP connection to the output stream from the node.js pair.

*Mux Singleton* - All of the node.js stream pairs created by the Mux Listener will be muxed together onto a single node.js intput/output stream pair that we call the Mux Singleton.

*Native Singleton* - This is a TCP/IP listener that accepts exactly one TCP/IP connection at a time and it is that TCP/IP connection that is transported over the non-TCP/IP transport.

Putting these components together we end up with a relay. The HTTP client tells the Mux layer to connect to the non-TCP/IP transport. This causes the Native Singleton to expose a TCP/IP Listener which will accept one TCP/IP connection that will come in from the Mux Singleton. The Mux Listener will then start its TCP/IP listener and accept an unlimited number of connections all of which will be muxed together and sent to the Mux Singleton. Finally the HTTP Client will open a TCP/IP connection against the Mux Listener and the story is complete.

To draw a picture of how all this works I need to introduce a quick notation:

Device-Component-Protocol

The Device indicates if we are talking about the client device or the server device. We will use ’C’ and ’S’ respectively.

The Component is the name of the part given in the list above.

The Protocol is what protocol the component is speaking, either TCP/IP or Node.js streams. We will note this as ’T’ and ’N’ respectively.

    HTTP Client <-->
    Mux Listener <-->
    [

To continue the conversation I have to introduce a nomenclature, otherwise it becomes impossible to tell who the players are.

Device-Component-Protocol

The device indicates if this the client device or the server device as previously defined. We refer to these as ’C’ and ’S’ respectively.

Component indicates which of the set of components involved in this mess we are talking about. I will introduce them all below.

Protocol indicates if the communication is over TCP/IP or a Node.js stream. We will use ’T’ and ’N’ to indicate which we mean.

Mux Listener-N - This represents two paired Node.js streams, one an input stream and the other an output stream. Whenever someone connects to Mux Listener-T, causing a TCP/IP connection to be created, that TCP/IP connection will be paired with a Node.js input and output stream created by Mux Lis

*C-HTTP Client-T* - This is the HTTP client on the client device that is using TCP/IP to try to issue its GET request to the server device.

*C-Mux Listener X-T* - This represents a TCP/IP connection that was created when the HTTP Client asked the mux layer for a TCP/IP connection to the server device. We call it Mux Listener X because it is a TCP/IP connection from the MUX layer that is listening on port x.

*C-Mux Listener X-N* - This represents a pair of node.js streams that were created by the Mux layer in response to the creation of C-Mux Listener X-T.

*C-Mux Singleton-N* - This represents a singleton pair of node.js streams that the Mux layer multiplexes al the C-Mux Listener X-N connections onto.

*C-Native Singleton-T* - This represents the singleton TCP/IP connection that is bound to the non-TCP/IP transport.

So the data flow is:

    C-HTTP Client-T <-->
    C-Mux Listener X-T <-->
    [TCP/IP to Node.js Stream Bridge] <-->
    C-Mux Listener X-N <-->
    [Mux Layer] <-->
    C-Mux Singleton-N <-->
    [TCP/IP to Node.js Stream Bridge] <-->
    C-Native Singleton-T <-->
    [TCP/IP to Non-TCP/IP Transport Bridge]

The objects above all represent pairs of input/output streams. The top entry, C-HTTP Client-T represents a TCP/IP client stream pair initiated by the local HTTP Client. That TCP/IP client stream then terminates in the Mux

    Client Device HTTP TCP/IP Client Output Stream --> 
    Client Device TCP/IP Mux Listener Port X Input Stream --> 
    [TCP/IP to Node.js Stream Bridge] --> 
    Client Device Node.js Mux Listener Port X Input Stream --> 
    [Mux Layer] --> 
    Client Device Node.js Mux Listener Singleton Input Stream --> 
    [TCP/IP to Node.js Stream Bridge] --> 
    Client Device TCP/IP Singleton Listener Input Stream --> 
    [TCP/IP to Non-TCP/IP Transport Bridge] -->
    Input Stream for non-TCP/IP Transport

and

    Client Device HTTP TCP/IP Client Input Stream <-- 
    Client Device TCP/IP Mux Listener Port X Output Stream <-- 
    [TCP/IP to Node.js Stream Bridge] <--
    Client Device Node.js Mux Listener Port X Output Stream <-- 
    [Mux Layer] <-- 
    Client Device Node.js Mux Listener Singleton Output Stream <-- 
    [TCP/IP to Node.js Stream Bridge] <--
    Client Device TCP/IP Singleton Listener Output Stream <-- 
    [TCP/IP to Non-TCP/IP Transport Bridge] <--
    Output Stream for non-TCP/IP Tranport

And of course we have the inverse of all this on Device B. In the case of Device B we have a local HTTP server that is running on some well known local port. So when a TCP/IP client request comes in it will terminate onto the Server Device HTTP TCP/IP Listener Port X Input and Output Streams. In this case Port X isn’t literally meant to be the same port X as will be used in the other names. But rather is just a binding to specify who this stream gets its input/output from.

Talking to Server Device HTTP TCP/IP Listener Port X Input and Output streams is Server Device TCP/IP Mux Client Port X Input and Output Streams. This is a TCP/IP client created by the Mux layer to relay request to the server.

But of course multiplex doesn’t actually speak TCP/IP so we feed data to the Server Device TCP/IP Mux Client Port X Input and Output Streams from the Server Device Node.js Mux Client Port X Input and Output streams. This is actually created by the multiplex layer when it unpacks a muxed data stream.

That muxed data stream comes from the Server Device Node.js Mux Client Singleton Input and Output stream. This is the node.js stream that contains all the TCP/IP connections muxed together.

The data for Server Device Node.js Mux Client Singleton Input and Output streams comes from TCP/IP via the Server Device TCP/IP Singleton Client Input and Output streams. This is TCP/IP client that relays data from the non-TCP/IP transport onto a singleton TCP/IP connection. How this works is defined by the binding for the non-TCP/IP transport.

So if we put this all together we get (besides a serious headache):

    Server Device HTTP TCP/IP Listener Port X Input Stream <-- 
    Server Device TCP/IP Mux Client Port X Output Stream <-- 
    [TCP/IP to Node.js Stream Bridge] <--
    Server Device Node.js Mux Client Port X Output Stream <-- 
    [Mux Layer] <-- 
    Server Device Node.js Mux Client Singleton Output Stream <-- 
    [TCP/IP to Node.js Stream Bridge] <--
    Server Device TCP/IP Singleton Client Output Stream <-- 
    [TCP/IP to Non-TCP/IP Transport Bridge] <--
    Output stream for non-TCP/IP Transport

as well as

    Server Device HTTP TCP/IP Listener Port X Output Stream --> 
    Server Device TCP/IP Mux Client Port X Input Stream --> 
    [TCP/IP to Node.js Stream Bridge] -->
    Server Device Node.js Mux Client Port X Input Stream --> 
    [Mux Layer] --> 
    Server Device Node.js Mux Client Singleton Input Stream --> 
    [TCP/IP to Node.js Stream Bridge] -->
    Server Device TCP/IP Singleton Client Input Stream --> 
    [TCP/IP to Non-TCP/IP Transport Bridge] -->
    Input stream for non-TCP/IP Transport

Therefore our solution is to implement a multiplex layer on top of the singleton TCP/IP connection using .

The terminology here gets ugly and confusing so please pay attention. We do this for a living and it’s confusing.

Singleton TCP/IP Connection - This is a TCP/IP connection created over the non-TCP/IP transport using the binding specified below for the transport in question.

Thali Client - This is the Thali peer that initiated the Singleton TCP/IP connection.

Thali Server - This is the Thali peer that received the Singleton TCP/IP connection.

When a Thali Client wants to connect to the Thali Server over the Singleton TCP/IP connection this works as follows: 1. The Thali Client will create a TCP/IP listener on localhost on some random port 2. The Thali Client will then connect to the localhost TCP/IP listener using a TCP/IP client. At any time there can be exactly one connection to the TCP/IP listener since we only support a single TCP/IP connection at a time over the underlying non-TCP/IP transport.

Thali Client TCP/IP Client Output Stream - This is the output stream owned by the TCP/IP client used by the Thali Client to talk to the TCP/IP listener that controls the Singleton TCP/IP connection. (Say that three times fast)

Thali Client TCP/IP Client Input Stream - This is the input stream owned by the TCP/IP client used by the Thali Client to talk to the TCP/IP listener that controls the Singleton TCP/IP connection.

Thali Client TCP/IP Listener Output Stream - This is the output stream owned by the TCP/IP listener used by the Thali Client to send messages over the Singleton TCP/IP Connection.

Thali Client TCP/IP Listener Input Stream - This is the input stream owned by the TCP/IP listener used by the Thali Client to receive messages over the Singleton TCP/IP Connection.

So the data flow for the Thali Client is:

    Non-TCP/IP transport ---> Thali Client TCP/IP Listener Output Stream --> Thali Client TCP/IP Client Input Stream
                         <--- Thali Client TCP/IP Listener Input Stream <-- Thali Client TCP/IP Client Output Stream

The exact same process happens in reverse for the Thali Server. That is, when a non-TCP/IP transport has a connection initiated to the Thali Server the non-TCP/IP transport will bridge to a Thali Server TCP/IP Client who will then connect the Singleton TCP/IP Connection to the TCP/IP Client who will then talk to the local server.

    Non-TCP/IP transport ---> Thali Server TCP/IP Client Input Stream --> Some local server's TCP/IP Listener Input Stream
                         <--- Thali Server TCP/IP Client Output Stream <-- Some local server's TCP/IP Listener Output Stream

The trick then is that we need to create a situation where we can send many independent TCP/IP connections over the Singleton TCP/IP Connection. As mentioned above we do this using the multiplex library. This library takes independent Node.js input/output streams and muxes them into a single Node.js input/output stream which we then bridge onto the Singleton TCP/IP connection.

The resulting architecture is confusing enough to make my nose bleed.

    Non-TCP/IP transport ---> Thali Client TCP/IP Listener Output Stream --> Thali Client TCP/IP Client Input Stream --> Thali Client Mux TCP/IP Listener Input Stream --> Thali Client M
                         <--- Thali Client TCP/IP Listener Input Stream <-- Thali Client TCP/IP Client Output Stream

