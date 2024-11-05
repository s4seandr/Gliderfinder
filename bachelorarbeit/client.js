/**
 * Bachelorarbeit SoSe 2024
 * @author: Sebastian, Andres
 * File connects with the live.glidernet.org and processes the data
 *
 * Links: http://wiki.glidernet.org/wiki:ogn-flavoured-aprs
 */

// 'strings' saves the preprocessed results in an array of strings
let strings = [];
// 'objects' saves the flight objects; see structure in class glider
let objects = [];
// 'loadedID' saves the ID of the glider, that gets loaded
let loadedID = null;
// 'intervalTime' is the time it takes to run the connection again
let intervalTime = 4999;
// 'trackingMode' switches the tracking interval method
let trackingMode = 1;
// 'timestamps' is used to store the timestamps for the tracking interval
let timestamps = [];
// 'positions' is used to store the positions for the tracking interval
let positions = [];
// 'intervalID' is saves the specific interval, so it can be stopped/changed if needed
let intervalID;

function connection (loadedID, left_lat, left_long, right_lat, right_long) {
    const point_one = [left_lat, left_long];
    const point_two = [right_lat, right_long];
    let check = false;
    let get = false;

    const request = new XMLHttpRequest();
    const url= "https://live.glidernet.org/lxml.php?a=0&b="+point_one[0]+"&c="+point_two[0]+"&d="+point_two[1]+"&e="+point_one[1];
    request.open("GET", url);
    request.send();

    // request.onload will be executed, when the client gets a result
    request.onload = (e) => {
        let data = request.response;
        // console.log(data);
        preprocessing(data, check, loadedID, get, strings);
        console.log('CONNECTING...');
        console.log(url);
        console.log('---------- Daten aus der Liste von Strings: ----------');
        strings.forEach(e => console.log(e));
        console.log('------------------------------------------------------');
    }
}

// function 'preprocessing' edits the data and saves them in the list of strings 'strings'
function preprocessing (dataprocessing, check, loadedID, get, strings) {
    // pattern for start index
    let regex_N = new RegExp('[-+]?[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]');
    let firstIndex = (dataprocessing.search(regex_N));

    // anchor
    if(firstIndex == -1) {
        extraction(dataprocessing, check, loadedID,get,strings);
        return;
    }

    //pattern for last index
    let regex_M = new RegExp('\"/>');
    let lastIndex = dataprocessing.search((regex_M));

    // get only the string with information
    strings.push(dataprocessing.substring(firstIndex, lastIndex));

    // +3 because the pattern '"\>' causes a match again
    dataprocessing = dataprocessing.substring(lastIndex +3, (dataprocessing.length));

    // recursive call
    preprocessing(dataprocessing, check, loadedID, get, strings);
}

function extraction (data, check, loadedID, get, strings) {
    let push = true;
    for (let i = 0; i < strings.length; i++) {
        push = true;
        const data = strings[i].split(",");
        // if it is not a glider continue with the next object
        if (data[10] != 7) continue;

        //Glider is a glider from checklist
        if(check){
            for (let i = 0; i < selector.children.length; i++) {
                if('\"'+data[3]+ '\"' == localStorage.getItem(selector.children.item(i).id)){
                    console.log('Online: ' + data[3]);
                    selector.children.item(i).className = 'online';
                }
                if(data[3] == loadedID && get){
                    left_lat =   parseFloat(data[0]) + 0.09009;
                    left_long =  parseFloat(data[1]) - 0.09009;
                    right_lat =  parseFloat(data[0]) - 0.09009;
                    right_long = parseFloat(data[1]) + 0.09009;
                }
            }
            continue;
        }

        if (objects.length == 0) {
            // if it is not in the objects array, it is a new flight object -> push to the objects array
            objects.push(new Glider(data[3],data[2], [data[0],data[1]], data[4], data[5], data[10]));
            continue;
        }

        // check, whether cn is in the objects array
            for (let j = 0; j < objects.length; j++) {
                if (objects[j] == null) continue;
                if (data[2] == (objects[j].cn)) {
                    const oldcoords = objects[j].stack.peek();
                    objects[j].pointlist.push(new L.LatLng(data[0], data[1]));


                    if ((data[0] != oldcoords[0]) || (data[1] != oldcoords[1])) {
                        // if they are different push
                        objects[j].stack.add([data[0], data[1]]);
                        objects[j].altitude = data[4];
                        console.log( 'Time: ' + data[5] + ',  Position: ' + data[0] + ' ' + data[1] )
                        objects[j].time = data[5];
                        // chose the tracking method and change the intervalTime
                        if(data[3] == loadedID) {
                            switch (trackingMode) {
                                case 0:
                                    speedbasedTracking(data[5], data[0], data[1]);
                                    break;
                                case 1:
                                    timebasedTracking(data[5]);
                                    break;
                            }
                        }
                    }
                    // set updated to true
                    objects[j].updated = true;
                    // cn is existing
                    push = false;
                }
            }

        // if it is not in the objects array, it is a new flight object -> push to the objects array
        if (push) objects.push(new Glider(data[3],data[2], [data[0],data[1]], data[4], data[5], data[10]));
    }

    // delete all gliders, which are not updated
    for (let k = 0; k < objects.length; k++) {
        if (objects[k] == null) continue;
        if (objects[k].updated == false) {
            map.removeLayer(objects[k].icon);
            if (objects[k].path != null) map.removeLayer(objects[k].path);
            objects[k] = null;
        }
    }
    // display icons
    showIcon(objects, loadedID);
}

class Glider {
    constructor (regid, cn, coords, altitude, time, symbolType) {
        this.regid = regid;
        this.cn = cn;
        // [latitude (lat), longitude (lng)]
        // create a new stack
        this.stack = new Stack();
        // add cords to the stack
        this.stack.add(coords);
        this.altitude = altitude;
        this.time = time;
        // symbol type 0 - 15
        this.symbolType = symbolType;
        this.icon = null;
        // save size of the stack
        this.stackSize = 0;
        // save whether glider was updated
        this.updated = true;
        this.pointlist = new Array();
        this.pointlist.push(new L.LatLng(coords[0], coords[1]));
        this.path = null;
    }
}

// structure stack for saving coords history of each glider
// program to implement stack data structure
// URL: https://www.programiz.com/javascript/examples/stack
class Stack {
    constructor() {
        this.items = [];
    }

    // add element to the stack
    add(element) {
        return this.items.push(element);
    }

    // remove element from the stack
    remove() {
        if(this.items.length > 0) {
            return this.items.pop();
        }
    }

    // view the last element
    peek() {
        return this.items[this.items.length - 1];
    }

    // check if the stack is empty
    isEmpty(){
        return this.items.length == 0;
    }

    // the size of the stack
    size(){
        return this.items.length;
    }

    // empty the stack
    clear(){
        this.items = [];
    }
}

function check_online_glider(loadedID, strings) {
        for (let i = 0; i < selector.children.length; i++) {
            selector.children.item(i).className = 'offline';
        }
        const check_point_one = ['90.000000', '-180.000000'];
        const check_point_two = ['-90.000000', '180.000000'];
        let check = true;
        let get = false;
        let string = [];
        const request = new XMLHttpRequest();
        const url= "https://live.glidernet.org/lxml.php?a=0&b="+check_point_one[0]+"&c="+check_point_two[0]+"&d="+check_point_two[1]+"&e="+check_point_one[1];
        request.open("GET", url);
        request.send();
        request.onload = (e) => {
            let data = request.response;
            console.log('CONNECTING TO ONLINE-CHECK...');
            preprocessing(data, check, loadedID, get, string);
	}
}

function get_glider_position(loadedID, strings) {

    const point_one = ['90.000000', '-180.000000'];
    const point_two = ['-90.000000', '180.000000'];
    let check = true;
    let get = true;
    const request = new XMLHttpRequest();
    const url= "https://live.glidernet.org/lxml.php?a=0&b="+point_one[0]+"&c="+point_two[0]+"&d="+point_two[1]+"&e="+point_one[1];
    request.open("GET", url);
    request.send();
    request.onload = (e) => {
        let data = request.response;
        console.log('GETTING GLIDER POSITION...');
        preprocessing(data, check, loadedID, get, strings);
    }
    startInterval();
}

function speedbasedTracking(timestamp, lat, lon){
	console.log('---speedbased tracking---');
	const parts = timestamp.split(':');
	const timeInSeconds = (+parts[0] * 3600) + (+parts[1] * 60) + (+parts[2]);
	timestamps.push(timeInSeconds);
	positions.push({ lat, lon });
	
	if (positions.length > 5) {
		timestamps.shift();
		positions.shift();
	}
	
	if (positions.length === 5) {
		let totalDistance = 0;
		let totalTime = (timestamps[timestamps.length - 1] - timestamps[0]) / 3600;
		for (let i = 1; i < positions.length; i++) {
			totalDistance += distanceInKmBetweenEarthCoordinates(positions[i-1].lat, positions[i-1].lon, positions[i].lat, positions[i].lon);
		}
		const averageSpeed = (totalDistance / totalTime); // Geschwindigkeit in km/h
		console.log('---Average Speed (in km/h): ' + averageSpeed);
		// Interval time adjustment based on average speed
		let newIntervalTime;
		if (averageSpeed > 70) {
			newIntervalTime = 5000; // 5 seconds
		} else if (averageSpeed < 20) {
			newIntervalTime = 30000; // 30 seconds
		} else {
			// Linear interpolation between 5 and 30 seconds for speeds between 20 and 70 km/h
			newIntervalTime = 5000 + ((averageSpeed - 20) / 50) * (30000 - 5000);
		}
		if (Math.abs(newIntervalTime - intervalTime) > 1000) { // Check if the difference is more than 1 second
            intervalTime = newIntervalTime;
            startInterval();
		}
		console.log('---Speed Interval Time (in ms): ' + intervalTime);
	}
}

function timebasedTracking(timestamp){
	console.log('---timebased tracking---');
    	const parts = timestamp.split(':');
    	const timeInSeconds = (+parts[0] * 3600) + (+parts[1] * 60) + (+parts[2]);
    	timestamps.push(timeInSeconds);
    	
	// After 5 timestamps set the intervalTime
    	if (timestamps.length === 5) {
        	// calculate the lowest time between two timestamps
        	let minInterval = Infinity;
        	for (let i = 1; i < timestamps.length; i++) {
            		let interval = timestamps[i] - timestamps[i - 1];
            		if (interval < minInterval) {
                		minInterval = interval;
            		}
        	}
		if(intervalTime == 4999){
        		intervalTime = minInterval * 1000;
			startInterval();
		}else if(minInterval * 1000 < intervalTime){
			intervalTime = minInterval * 1000;
			startInterval();
		}
        	
		console.log('---Interval Time (in ms): ' + intervalTime);
		// remove all values except the last
        	timestamps = [timestamps[timestamps.length - 1]];
    	}
}


function setloadedID(lID) {
	loadedID = lID;
}

function update() {

    strings = new Array();
    connection(loadedID, left_lat, left_long, right_lat, right_long);
}

// start an Interval
function startInterval() {
    if (intervalID) {
        clearInterval(intervalID); 
    }
    intervalID = setInterval(update, intervalTime); // Neues Intervall starten
}

// function degreesToRadius is needed for calculating the distance
function degreesToRadians (degrees) {
    return degrees * Math.PI / 180;
}

// function distanceInKmBetweenEarthCoordinates calculates the distance between to coordinates and return the distance in km
function distanceInKmBetweenEarthCoordinates (lat1, lon1, lat2, lon2) {
    let earthRadiusKm = 6371;

    let dLat = degreesToRadians(lat2-lat1);
    let dLon = degreesToRadians(lon2-lon1);

    lat1 = degreesToRadians(lat1);
    lat2 = degreesToRadians(lat2);

    let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return earthRadiusKm * c;
}