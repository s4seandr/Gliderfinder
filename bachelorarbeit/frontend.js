/**
 * Bachelorarbeit wise 2023/2024
 * @author: Sebastian, Andres
 * Links: URL:https://github.com/geoman-io/leaflet-geoman
 *        URL: https://stackoverflow.com/questions/7342957/how-do-you-round-to-1-decimal-place-in-javascript
 *        URL: https://github.com/geoman-io/leaflet-geoman/issues/642
 *        URL: https://stackoverflow.com/questions/365826/calculate-distance-between-2-gps-coordinates
 */

let left_lat = '90.000000';
let left_long = '-180.000000';
let right_lat = '-90.000000';
let right_long = '180.000000';
const alert_field = document.getElementById('alert');
const selector = document.getElementById('selector');

const name_field = document.getElementById('name');
const save_button = document.getElementById('save');
const load_button = document.getElementById('load');
const reg_field = document.getElementById('regid');
const delete_button = document.getElementById('delete');
const check_button = document.getElementById('online_check');
const changeTrackingMethod = document.getElementById('changeTrackingMethod');

//global object for saving the coordinates of the rectangle
let rectangleObject;

//global object for saving the regID of the glider
let regID;

// global parameter layer
let layer;


let map = L.map('map').setView([49.452000, 6.382100], 6);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// add the items of the localstorage to the option selector, if the page will be reloaded
setSelectorOptions();

// method getCoords return the coordinates of the rectangle as a string
function getCoords (feature) {
    return `${feature.geometry.coordinates}`;
}


map.on('pm:globaleditmodetoggled', function(e) {
    console.log("Ausgeführt");
});

map.on('pm:create', function (e) {
    layer = e.layer;

    // change the color inside the rectangle
    layer.setStyle({fillColor :'#ffffff'});

    let feature = layer.toGeoJSON();

    let coords1 = getCoords(feature);

    // extract the coords of the string and save the coords in an object rectangle
    rectangleObject = rectangleCoords(coords1);

    // show the coordinates in the boxes
    setValues();

    // call method connection in the file: client.js
    connection(loadedID, left_lat, left_long, right_lat, right_long);

    layer.on('pm:update', function (e) {
        // get the updated coordinates of the layer
        feature = layer.toGeoJSON();

        // return the coords as a string -> method getCoords
        let coordsupdated = getCoords(feature);

        // extract the coords of the string and save the coords in an object rectangle -> rectangleObject is a global Object
        rectangleObject = rectangleCoords(coordsupdated);

        // update the coordinates in the boxes
        setValues();

        // show output text
        alert_field.innerText = 'Suchgebiet verschoben! Glider werden geladen ... ';

        // delete array of strings and objects; delete displayed icons
	    removeAllMarkers(objects);
        strings = new Array();
        objects = new Array();


        connection(loadedID, left_lat, left_long, right_lat, right_long);
    });

});

map.on('pm:remove', function(d) {
    // delete coordinates in the output fields
    deleteValues();

    // show output text
    alert_field.innerText = 'Suchgebiet gelöscht! Bitte neues Suchgebiet einzeichnen!';

    // delete all in sttrings and objects array
    deleteIcon();
    strings = new Array();
    objects = new Array();

    // can not save areas, if the area is not drawn -> if the area will be deleted no saving possible
    rectangleObject = null;
});

// event listener, if button save is pressed
save_button.addEventListener('click', function(e) {
    const key = name_field.value;
    regID = reg_field.value;

    // reset values
    name_field.value = null;
    reg_field.value = null;


    // check, whether key is still existing
    if (key == '' || regID == '') {
        alert_field.innerText = "Keine Speicherung des Gliders möglich!"
        return;
    }

    if (window.localStorage.getItem(key) == null) {
        const value = JSON.stringify(regID);
        window.localStorage.setItem(key, value);

        // append to selector
        let opt = document.createElement('option');
        opt.id = key;
        opt.innerHTML = key;
        selector.appendChild(opt);
        alert_field.innerText = "Glider erfolgreich gespeichert!"
    } else {
        alert_field.innerText = "Keine Speicherung des Gliders möglich!"
    }
});

function setSelectorOptions () {
    for (let i = 0; i < localStorage.length; i++) {
        let opt = document.createElement('option');
        const keyItemLocalStorage = localStorage.key(i);
        opt.value = keyItemLocalStorage;
        opt.id = keyItemLocalStorage;
        opt.innerHTML = keyItemLocalStorage;
        selector.appendChild(opt);
    }
}

delete_button.addEventListener('click', function(e) {
    if(confirm("Wollen Sie Nutzer " + selector.children.item(selector.selectedIndex).value + " aus Ihrer Freundesliste entfernen?")) {
	alert("Glider gelöscht!");
        console.log('DELETE: ' + selector.children.item(selector.selectedIndex).value);
        localStorage.removeItem(selector.children.item(selector.selectedIndex).value);
        selector.remove(selector.selectedIndex);
    } else {
        alert("Löschen abgebrochen.");
    }
});

load_button.addEventListener('click', function(e) {
    removeAllMarkers(objects);
    intervalTime = 4999;
    const key = selector.value;
    const object = localStorage.getItem(key);
    //const parsedData = JSON.parse(object);
    const loadedID = JSON.parse(object);

    console.log('--------REG.-ID-----------');
    console.log(loadedID);
    setloadedID(loadedID);
    alert_field.innerText = 'Freund wird gesucht!';
    //set strings and objects []
    strings = [];
    objects = [];
    //reset lat and long
    left_lat =   '90.000000';
    left_long =  '-180.000000';
    right_lat =  '-90.000000';
    right_long = '180.000000';

    //let bounds = [[parsedData.topleftlat, parsedData.topleftlong], [parsedData.bottomrightlat, parsedData.bottomrightlong]];

    // start XML-Request
    get_glider_position(loadedID, strings);
});

check_button.addEventListener('click', function (e) {
    check_online_glider(loadedID,strings);
});

// change the tracking Method that is used
changeTrackingMethod.addEventListener('click', function(MouseEvent) {
    if(this.innerHTML == 'timebased Tracking'){
        this.style.backgroundColor = 'green';
        this.innerHTML = 'speedbased Tracking';
        trackingMode = 0;
    }else if(this.innerHTML == 'speedbased Tracking'){
        this.style.backgroundColor = '#007bff';
        this.innerHTML = 'timebased Tracking';
        trackingMode = 1;
    }
});

// method displayIcon()
function showIcon (objects, loadedID) {

    for (let i = 0; i < objects.length; i++) {

        if (objects[i] == null) continue;

        if (objects[i].stackSize == 0) {
            let myIcon;

            if(objects[i].regid == loadedID){
                myIcon = L.icon({
                    iconUrl: 'paraglider_dark_mode.svg',
                    iconSize: [40, 40],
                });
            }else {
                myIcon = L.icon({
                    iconUrl: 'paraglider_dark_mode_2.svg',
                    iconSize: [40, 40],
                });
                //uncomment to also check for friends
                let j = localStorage.length;
                while(j--){
                    if('\"'+objects[i].regid+'\"' == localStorage.getItem(selector.children.item(j).value)){
                        myIcon = L.icon({
                            iconUrl: 'paraglider_dark_mode_3.svg',
                            iconSize: [40, 40],
                        });
                        break;
                    }
                }
            }

            // see the peek of the stack to display
            let marker = L.marker(objects[i].stack.peek(), {icon: myIcon}).addTo(map).bindPopup("<h5>Reg.-ID: " + objects[i].regid + "</h5><p>Höhe: " + 		objects[i].altitude + " m</p><p>Time: " + objects[i].time + "</p>");
            // do not allow to drag or delete icons
            marker.pm.enable({draggable: false, allowRemoval: false});
            objects[i].icon = marker;

            objects[i].stackSize = objects[i].stack.size();
            if(objects[i].regid == loadedID){
                map.setView(objects[i].pointlist.at(0),7, {animation: true});
            }
	    console.log('--------COORDS------------');
        console.log(left_lat + ' | ' + left_long + ' | ' + right_lat + ' | ' + right_long);

        alert_field.innerText = 'Freund gefunden!';
        document.getElementById('ex1').value = left_lat - 0.09009;
        document.getElementById('ex2').value = left_long + 0.09009;
        } else {
            if (objects[i].stack.size() != objects[i].stackSize) {
                map.removeLayer(objects[i].icon);
                let myIcon;
                let path_color;
                if(objects[i].regid == loadedID){
                    myIcon = L.icon({
                        iconUrl: 'paraglider_dark_mode.svg',
                        iconSize: [40, 40],
                    });
                    path_color = '#549AFC';
                    document.getElementById('ex1').value = left_lat - 0.09009;
                    document.getElementById('ex2').value = left_long + 0.09009;
                }else {
                    myIcon = L.icon({
                        iconUrl: 'paraglider_dark_mode_2.svg',
                        iconSize: [40, 40],
                    });
                    path_color = '#808080';

                    if(objects[i].icon.getIcon().options.iconUrl == 'paraglider_dark_mode_3.svg'){
                        myIcon = L.icon({
                            iconUrl: 'paraglider_dark_mode_3.svg',
                            iconSize: [40, 40],
                        });
                        path_color = '#32CD32';

                    }
                }
                // see the peek of the stack to display
            let marker = L.marker(objects[i].stack.peek(), {icon: myIcon}).addTo(map).bindPopup("<h5>Reg.-ID: " + objects[i].regid + "</h5><p>Höhe: " + objects[i].altitude + " m</p><p>Time: " + objects[i].time + "</p>");
                // do not allow to drag or delete icons
                marker.pm.enable({draggable: false, allowRemoval: false});
                objects[i].icon = marker;
                old_path = objects[i].path;
                objects[i].path = L.polyline(objects[i].pointlist, {
                    color: path_color,
                    weight: 3,
                    opacity: 0.7,
                }).addTo(map);
                map.removeLayer(old_path);

                objects[i].stackSize = objects[i].stack.size();
            }
        }

        // set updated to false
        objects[i].updated = false;
    }
}

// function removeAllMarkers removes all icons placed on the map
function removeAllMarkers(objects) {
    for (let i = 0; i < objects.length; i++) {
        if (objects[i] == null) continue;
        if (objects[i].icon != null && map.hasLayer(objects[i].icon) == true) {
            map.removeLayer(objects[i].icon);
            if (objects[i].path != null) map.removeLayer(objects[i].path);
        }
    }
    // if all icons are removed from the array => delete the data in the array
    objects = new Array();
}

// function rectangleCoords helps to extract the coordiantes from the string
function rectangleCoords (data) {
    // split the string in the coords
    const temp = data.split(',');

    // choose the right coordiantes of the rectangle
    const topleftlat = temp[3];
    //.replace(/\s+/, ""); delete white space in the substring
    const topleftlong = temp[2].replace(/\s+/, "");
    const bottomrightlat = temp[7];
    const bottomrightlong = temp[6];

    // crate a new rectangle object and return the object
    return new Rectangle(topleftlat, topleftlong, bottomrightlat, bottomrightlong);
}

// class rectangle helps to structure the coordinates of the rectangle
class Rectangle {
    // latitude and longitude of top-left coordinate
    #topleftlat;
    #topleftlong;
    // latitude and lonitude of bottom-right coordinate
    #bottomrightlat;
    #bottomrightlong;

    constructor (topleftlat, topleftlong, bottomrightlat, bottomrightlong) {
        this.topleftlat = topleftlat;
        this.topleftlong = topleftlong;
        this.bottomrightlat = bottomrightlat;
        this.bottomrightlong = bottomrightlong;
    }

    // method for printing the information of a rectangle
    print() {
        let temp ='Gebietskoordinaten: ';
        temp += this.topleftlat + ', ' + this.topleftlong + ' / ' + this.bottomrightlat + ', ' + this.bottomrightlong;
        console.log(temp);
    }
}