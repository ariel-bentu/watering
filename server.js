#!/usr/bin/env node
var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');

var connectedDevices = [];
 
var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
	prompt();
});
 
wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production 
    // applications, as it defeats all standard cross-origin protection 
    // facilities built into the protocol and the browser.  You should 
    // *always* verify the connection's origin and decide whether or not 
    // to accept it. 
    autoAcceptConnections: false
});
 
function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed. 
  return true;
}
 
wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin 
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    
    var connection = request.accept('watering', request.origin);
    console.log((new Date()) + ' Connection accepted.');
	prompt();
	
	connectedDevices.push(connection);
    
	connection.on('message', function(message) {
        if (message.type === 'utf8') {
            var msg = message.utf8Data;
			if (msg.startsWith('register ')) {
				var name = msg.substring(9);
				console.log('setting name ' + name);
				connection.name = name;
				prompt();
			} else if (msg.startsWith('log ')) {
				console.log('['+connection.name+']:'+msg.substring(4));
				
			} 
			
        }
        else if (message.type === 'binary') {
            console.log('Binary is not supported');
        }
		prompt();
    });
    
	connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
		prompt();
		//remove from list
		var index = connectedDevices.findIndex(function (obj) {return obj === connection;}); 
		if (index >= 0) {
			connectedDevices.splice(index, 1);
		}
    });
});


var stdin = process.openStdin();

stdin.addListener("data", function(d) {
    // note:  d is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that  
    // with toString() and then trim() 
	var commands = d.toString().trim().split(/[ ,]+/);
    //console.log("you entered: [" + command + "]");
	
	if (commands.length  == 0)
		return;
	
	if (commands[0] == 'list' && commands.length == 1) {
		for (var i=0;i<connectedDevices.length;i++) {
			if (connectedDevices[i].hasOwnProperty('name')) {
				console.log(connectedDevices[i].name);
			} else {
				console.log('unnamed');
			}
		}
	} else if (commands[0] == 'update' && commands.length == 3){
		var device = commands[1];
		var path = commands[2];
		var conn = findConnection(device);
		if (conn != null) {
			console.log(path);
			fs.readFile(path, 'utf8', function (err,data) {
			  if (err) {
				console.log(err);
			  }
			  
			  conn.send("update " + data);
			  console.log('updated configuration sent to device:  \'' + device + "'");
			});
		} else {
			console.log(device + ' not found!');
		}
	} else if (commands[0] == 'ping ' && commands.length == 2) {
		var device = commands[1];
		var conn = findConnection(device);
		if (conn != null) {
			conn.send("ping");
		}
	}
	
	prompt();
		
  });

  
function prompt() {
	process.stdout.write("$>");
}
  
function findConnection (name) {
	for (var i=0;i<connectedDevices.length;i++) {
			if (connectedDevices[i].name == name) {
				return connectedDevices[i];
			}
	}
	return null;
}
