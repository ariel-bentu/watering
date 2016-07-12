var W3CWebSocket = require('websocket').w3cwebsocket;
 
var client = null;
var pongArrived = true; 
var fs = require('fs');
var ini = require('ini');

var config = ini.parse(fs.readFileSync('./conf.ini', 'utf-8'))
var THIS = {"log": function log (str, localOnly) {
	console.log(str);
	if (!localOnly && client != null && client.readyState === client.OPEN) {
		client.send("log "+str);
	}
}};
 
function reconnect() {
	try {
		console.log('try reconnecting...');
		client = new W3CWebSocket(config.remote.url, "watering", {"keepAlive":{"enable":true, "initialDelay":10000}} );
		
		client.onerror = function() {
			console.log('Connection Error');
		};
		 
		client.onopen = function() {
			console.log('WebSocket Client Connected');
		 
			function register() {
				if (client != null && client.readyState === client.OPEN) {
					
					client.send('register ' + config.uname);
					setTimeout(sendPing, config.remote.pingRate);
				} else {
					setTimeout(register, 5000);
				}
			}
			register();
		};
		 
		client.onclose = function() {
			console.log('watering Client Closed');
			client = null;
			setTimeout(reconnect, config.remote.reconnectRate);
		};
		
		client.onmessage = function(e) {
		if (typeof e.data === 'string') {
			var msg = e.data;
			if (msg == 'ping') {
				THIS.log('pong');
			} else if (msg == 'pong') {
				pongArrived = true;
				console.log("pong arived" + (client == null?"client null" :"" )+ (client != null && client.readyState == client.OPEN?"clientOpened":client.readyState));
			} else if (msg.startsWith('update ')) {
				THIS.log ('update command recieved');
				var newDb = msg.substring(7);
				THIS.main.emit('saveDB', newDb);
			} 
			
		}
		
	};
		
	} catch (e) {
		client = null;
		THIS.log("Disconnected:"+e.message);
		setTimeout(reconnect, config.remote.reconnectRate);
		client = null;
	}
}

function sendPing() {
	return;
	if (client != null) {
		if (!pongArrived) {
			//connection is lost
			pongArrived = true;
			client.close();
			//client = null;
			reconnect();
		}
		else {
			pongArrived = false;
			client.send("ping");
			setTimeout(sendPing, config.remote.pingRate);
			console.log("ping");
		}
	}
}
 

reconnect();

module.exports = THIS;