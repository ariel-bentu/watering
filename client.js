"use strict";


var fs = require('fs')
var EventEmitter = require('events');  
//var dateFormat = require('dateformat');

class Main extends EventEmitter {}

const main = new Main();
var db = {};
var jobs = [];
const openValves = [];

var ws = require('./ws.js');
ws.main = main;
ws.log('Sprinklers program:');
ws.log('-------------------');


var CronJob = require('cron').CronJob;


main.on ('readDB', () => {
	fs.exists('./activeDB.json', function(exists){
		var fileName = exists ? './activeDB.json' : './db.json';
		fs.readFile(fileName, 'utf8', function (err,data) {
		  if (err) {
			ws.log(err);
			process.exit(-1);
		  }
		  ws.log("db '" + fileName + "' has been read successfully");
		  db = JSON.parse(data);
		  ws.log('db json parsed successfuly');
		  main.emit('activateDB');
		});
	});
	
});

main.on ('saveDB', (data) => {
	try {
		var testJson = JSON.parse(data);
		fs.writeFile('./activeDB.json', data, function(err) {
			if(err) {
				return console.log(err);
			}
			main.emit('readDB');
			ws.log("New active DB was saved!");
		}); 
	} catch(e) {
		ws.log('save DB:' + e.message);
	}
});


main.on ('activateDB', () => {
	ws.log("Start activating DB...");
	
	ws.log("Removing previous programs...");
	cancelAllSessions();
	ws.log("Done");
	
	for (var i=0;i<db.programs.length;i++) {
		if (db.programs[i].enabled) {
			ws.log("Activating program '"+db.programs[i].name+"'");
		
			for (var j=0;j<db.programs[i].valves.length;j++) {
				var valve = db.programs[i].valves[j];
				var dependentValvesIDs = [];
				if (valve.hasOwnProperty('dependentValvesIDs')) {
					dependentValvesIDs.push(valve.dependentValvesIDs);
				}
				ws.log("Scheduling valve '" + valve.name + "' - " + valve.ID);

				for (var k=0;k<valve.sessions.length;k++) {
					var session = valve.sessions[k];
					if (session.enabled) {
						const id = [];
						const duration = session.schedule.duration;
						id.push(valve.ID);
						id.push(dependentValvesIDs);
						
						var cronExp = getCronExp(session.schedule);
						
						var job = new CronJob({
							cronTime: cronExp,
							onTick: function() {
								openValve(id, duration);
							},
							start: false
						});
						ws.log("cron: " + cronExp + " - for " + session.schedule.duration + " minutes");
						job.start();
						
						addSession(session, job);
					}
				}
			
		
			}
		}
	}

	ws.log("DB is activated successfully!");
});

process.on('exit', (code) => {
  closeAllOpenValves();
});

process.on('uncaughtException', (err) => {
  ws.log('Error:' + err + '...exiting');
  closeAllOpenValves();
});

process.on('SIGINT', () => {
  process.exit(-2);
});

function getCronExp(schedule) {
	var pattern = '0 ' + schedule.minute + ' ' + schedule.hour + ' * * ' + schedule.weekDays;
	//{"weekDays":"1", "hour":23, "minute":0, "duration":0.1}
	
	return pattern;
}

function addSession (session, job) {
	jobs.push(job);
}

function cancelAllSessions() {
	for (var i=0;i<jobs.length;i++) {
		jobs[i].stop();
	}
	jobs = [];
}

function openValve(id, durationMin) {
	var d = new Date();
	d.setTime (d.getTime() + 1000 * 60 * durationMin);
	var job = new CronJob(d, function() {
			closeValve(id)
		}, function () {
			/* This function is executed when the job stops */
		},
		true /* Start the job right now */
		//timeZone /* Time zone of this job. */
	);

	addSession(null, job);
	
	//TODO open valve
	addToOpenValves(id);
	ws.log(getDateTime() + ": VALVE "+id+" - NOW IS OPEN!");
}

function closeValve(id) {
	//TODO close valve
	ws.log(getDateTime() + ": VALVE "+id+" - NOW IS CLOSED!");
	removeFromOpenValves(id);
}

function getDateTime() {
	return new Date();//dateFormat(new Date(), "dddd, mmmm dS, yyyy, h:MM:ss");
}
function removeFromOpenValves(id) {
	for (var i=0;i<id.length;i++) {
		for (var j=0;j<openValves.length;j++) {
			if (openValves[j] === id[i])
				openValves.splice(j, 1);
		}
	}
}

function addToOpenValves(id) {
	for (var i=0;i<id.length;i++) {
		var found = false;
		for (var j=0;j<openValves.length && !found;j++) {
			if (openValves[j] === id[i])
				found = true;
		}
		if (!found) {
			openValves.push(id[i]);
		}
	}
}

function closeAllOpenValves() {
	ws.log("CLOSE ALL Valves:");
	closeValve(openValves);
	
}

main.emit('readDB');

