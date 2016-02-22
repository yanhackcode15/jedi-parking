// Place all the behaviors and hooks related to the matching controller here.
// All this logic will automatically be available in application.js.
"use strict";
window.addEventListener('load', function(){

window.smartParking = window.smartParking || {};
var infoWindow;
var map;
var meters = new Map();
var myMarker;
var watchId;
var currentPos;
var currentZoom;
var destinationMarker;
var destinationPos;
var directionsDisplay;
console.log('hello sunday!');

var t = Date.now();
function debugTimer(){
	var message = Array.apply(null, arguments);
	var tx = t;
	t = Date.now();
	var Δt = t - tx;
	message.push('Δt:' + Δt);
	console.log.apply(console, message);
}

initMap()
.then(function(){
	// getMeters();
	return Promise.all([
		getMeters(),
		getCurrentPosition(),
		geocodeSearchAddress()
	]);
})
.then(countMetersInArea)
.then(showRoute)
.catch(console.error.bind(console))
.then(pushSensorToClient);



function getMeters(){
	return new Promise(function(resolve, reject){
		debugTimer('getMeters');
		$.ajax({
			'url': "/meters",
			'dataType': "json"
		})
		.complete(resolve)
		.fail(reject);
	})
	.then(function (data) {
		debugTimer('getMeters callback');

		// Merge the new meter data with our existing meters
		data.forEach(function (meterData) {
			var meter = meters.get(meterData.meter_id) || {};
			meter = Object.assign({}, meter, meterData);
			meter.latlng = new google.maps.LatLng(meter.latitude, meter.longitude);
			meters.set(meterData.meter_id, meter);
		});

		// Keep a local copy of the basic meter data we have accumulated
		var storage = [];
		meters.forEach(function (meter, meter_id) {
			// we use a CSV format to reduce the data size since local storage is limited
			storage.push(meter_id);
			storage.push(meter.address);
			storage.push(meter.latitude);
			storage.push(meter.longitude);
		});
		localStorage.meters = JSON.stringify(storage);
		debugTimer('getMeters callback finished');
	});


}

function showMeterMarkers() {
	//wrap all these inside a zoom condition so this function will only execute if zoom is less than a value
	//retrieve current zoom
	debugTimer('showMeterMarkers');
	currentZoom = map.getZoom();
	var bounds = map.getBounds();
	var displayedCount = 0;
	// Update meters to show only if they are within the bounds)
	meters.forEach(function (meter, meter_id) {
		if (!meter.latlng) {
			// somehow we have a bad meter?
			console.info('Bad Meter:', meter_id, meter);
			meters.delete(meter_id);
			return;
		}
		
		if (!bounds.contains(meter.latlng) || currentZoom < 18){
			if (meter.marker) {
				// Remove meter from the map
				meter.marker.setMap(null);
			}
		} else {
			++displayedCount;
			if (!meter.marker) {
				// Set up the meter's marker
				var icon = {
					path: google.maps.SymbolPath.CIRCLE,
					scale: 5,
					fillColor: 'red',
					strokeColor: 'red',
					strokeWeight: 1,
					fillOpacity: 0.8
				};
				if (meter.event_type !== 'SS') {
					//if not taken or unknown, make it green
					icon.fillColor = 'green';
					icon.strokeColor = 'green';
				}
				meter.marker = new google.maps.Marker({
					position: meter.latlng,
					icon: icon
				});

				google.maps.event.addListener(meter.marker, 'click', (function (marker, address, id) {
					return function () {
						infoWindow.setContent(address+' '+id);
						infoWindow.open(map, marker);
					}
				})(meter.marker, meter.address, meter.meter_id));
			}
			if( meter.marker.getMap() !== map){
				// Display the meter on the map if it isn't already shown
				meter.marker.setMap(map);	
			}
		}
	});
	debugTimer('showMeterMarkers', 'zoom: '+currentZoom, 'showing ' + displayedCount+' (of '+ meters.size +' total meters)');
}


function handleLocationError(message) {
	infoWindow.setPosition(pos);
	infoWindow.setContent(message);
}

function initMap() {
	return new Promise(function (resolve, reject){
		debugTimer('initMap');

		try {
			var storage = JSON.parse(localStorage.meters);
			while (storage.length){
				var meter = {
					meter_id: ''+storage.shift(),
					address: ''+storage.shift(),
					latitude: +storage.shift(),
					longitude: +storage.shift()
				};
				meter.latlng = new google.maps.LatLng(meter.latitude, meter.longitude);
				meters.set(meter.meter_id, meter);
			}
		} catch (ignoredErr) {
			//Failed to parse local storage meters, so we use a blank object.
			localStorage.meters = '[]';
			meters = new Map();
		};
		debugTimer('initMap got meters from local storage', meters.size);

		var styles = [{"featureType":"landscape.natural","elementType":"geometry.fill","stylers":[{"visibility":"on"},{"color":"#e0efef"}]},{"featureType":"poi","elementType":"geometry.fill","stylers":[{"visibility":"on"},{"hue":"#1900ff"},{"color":"#c0e8e8"}]},{"featureType":"road","elementType":"geometry","stylers":[{"lightness":100},{"visibility":"simplified"}]},{"featureType":"road","elementType":"labels","stylers":[{"visibility":"on"}]},{"featureType":"transit.line","elementType":"geometry","stylers":[{"visibility":"on"},{"lightness":700}]},{"featureType":"water","elementType":"all","stylers":[{"color":"#7dcdcd"}]}];
		var styledMap = new google.maps.StyledMapType(styles, {name: "Styled Map"});
		var mapOptions = {
			zoom: 18,
			minZoom: 10,
			scaleControl: true,
			center: new google.maps.LatLng(34.024212, -118.496475),
			mapTypeControlOptions: {
				mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'map_style']
			}
		};
		
		var mapDiv = document.createElement('div');
		mapDiv.setAttribute('id', 'map');
		map = new google.maps.Map(mapDiv, mapOptions);
		map.mapTypes.set('map_style', styledMap);
		map.setMapTypeId('map_style');
		document.getElementById('mapContainer').appendChild(mapDiv);
		google.maps.event.addListener(map, 'idle', showMeterMarkers);

		var myMarkerIcon = {
			path: google.maps.SymbolPath.CIRCLE,
			scale: 5,
			fillColor: 'orange',
			strokeColor: 'orange',
			strokeWeight: 2,
			fillOpacity: 0.8
		};
		myMarker = new google.maps.Marker({icon: myMarkerIcon, map: map});
		infoWindow = new google.maps.InfoWindow({map: map});


		watchId = navigator.geolocation.watchPosition(
			function showMyMarker(pos){
				var crd = pos.coords;
				var position = new google.maps.LatLng(crd.latitude, crd.longitude);
				myMarker.setPosition(position);
			}, 
			function errorShowMyMarker(err){
				console.warn('ERROR(' + err.code + '): ' + err.message);
			}, 
			{
				enableHighAccuracy: false,
				timeout: 5000,
				maximumAge: 0
		});

		debugTimer('initMap finished');
		resolve();
	});
}


function showRoute(){
	return new Promise(function (resolve, reject) {
		debugTimer('showRoute');
		if (!currentPos || !destinationPos) {
			return resolve();
		}
		var directionsService = new google.maps.DirectionsService();
		var request = {
			origin: currentPos,
			destination: destinationPos,
			travelMode: google.maps.TravelMode.DRIVING
		};
		directionsService.route(request, function(directions, status) {
			debugTimer('showRoute callback');
			if (status == google.maps.DirectionsStatus.OK) {
				directionsDisplay = new google.maps.DirectionsRenderer({map: map, directions: directions});
			}
			debugTimer('showRoute callback finished');
			resolve();
		});
	});
}

function geocodeSearchAddress() {
	return new Promise(function (resolve, reject) {
		debugTimer('geocodeSearchAddress');

		var address = smartParking.searchAddress;
		if (''+address == ''){
			return resolve();
		}
		var geocoder = new google.maps.Geocoder();
		geocoder.geocode({ address: address }, function (results, status) {
			debugTimer('geocodeSearchAddress callback');
			if (status !== google.maps.GeocoderStatus.OK) {
				return reject('The address is either invalid or is not specific enough.');
			}

			var address = results[0].formatted_address;

			var numCommas = address.match(/,/g).length;
			if (numCommas >= 3) {
				address = address.replace(/, USA$/, '');
			}
			document.getElementById('address').value = address;
			destinationPos = results[0].geometry.location
			debugTimer('geocodeSearchAddress callback finished');
			resolve();
		});
	});
}

function getCurrentPosition() {
	return new Promise(function (resolve, reject){
		debugTimer('getCurrentPosition');
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function(position) {
				debugTimer('getCurrentPosition callback');
				currentPos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
				infoWindow.setPosition(currentPos);
				infoWindow.setContent('You are here!');
				debugTimer('getCurrentPosition callback finished');
				resolve();
				// map.setCenter(pos);
			}, function() {
				handleLocationError('Error: Your browser doesn\'t support geolocation.');
			});
		} else {
			// Browser doesn't support Geolocation
			handleLocationError('Error: The Geolocation service failed.');
		}
	});
}

function removeMeterZoomingOut(){
	//when zoom is less than 18, move meter markers off screen
	debugTimer('removeMeterZoomingOut');
	currentZoom = map.getZoom();
	console.info('Zoom:',currentZoom);
	var meter;
	if (currentZoom < 18){ 
		meters.forEach(function (meter, meter_id){
			if (meter.marker){
				meter.marker.setMap(null);
			}
		});
	}
}

function countMetersInArea() {
	//cal the number of available and vacant parkings within half a mile walking from the destination
	debugTimer('countMetersInArea');
	var counts = {'meterCount': 0, 'availMeterCount': 0};
	if (destinationPos){
		var lat2 = destinationPos.lat();
		var lng2 = destinationPos.lng();
		meters.forEach(function (meter, meter_id){
			var distance = getDistance(meter.latitude, meter.longitude, lat2, lng2);
			if (distance <= 0.125) {
				counts.meterCount += 1;
				if (meter.event_type != 'SS') {
					counts.availMeterCount += 1;
				}
			}
		});
		var countDisplay = "We found "+counts.availMeterCount+" available meters near the area!";

		displayAlert(countDisplay);
	}
	return counts;
}

function displayAlert(display){
	
	var alertDiv = document.createElement('div');
	var alert='<div type="div" class="alert alert-success alert-dismissible" role="alert" id="countAlertDiv" aria-label="Close"><button type="button" class="close" data-dismiss="alert" id="countAlertButton" aria-label="Close"><span aria-hidden="true">×</span></button>'+display+'</div>';

	alertDiv.innerHTML = alert;
	document.getElementById('mapContainer').appendChild(alertDiv.firstChild);

}

function getDistance(lat1, lng1, lat2, lng2) {
	var R = 3959; // miles
	var φ1 = lat1 / 360 * Math.PI;
	var φ2 = lat2 / 360 * Math.PI;
	var Δφ = (lat2-lat1) / 360 * Math.PI;
	var Δλ = (lng2-lng1) / 360 * Math.PI;

	var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
	        Math.cos(φ1) * Math.cos(φ2) *
	        Math.sin(Δλ/2) * Math.sin(Δλ/2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	var d = R * c;
	return d;
}

function resetView() {
	//when user is close to the desitnation (0.25 miles away), reset zoom and recenter the map around the destination at a very close zoom
	//first listen and determine when the treshold is hit. 
	//run the distance calc 
	var distance = getDistance(currentPos.lat(), currentPos.lng(), destinationPos.lat(), destinationPos.lng());

	if (distance<=0.15){
		//set zoom to x
		map.setZoom(18);
	}
}

function pushSensorToClient() {
	// debugger;
	window.client = new Faye.Client('http://localhost:9292/faye');
	var subscription = client.subscribe('/meters/update', function(payload) {
		console.log(payload);
		if (payload && payload.message && payload.message.meter_id){
			//update the meter info with the new event type, event time
			var meter = meters.get(payload.message.meter_id) || payload.message;
			meter.event_type = payload.message.event_type
			meter.event_time = payload.message.event_time
			meters.set(meter.meter_id, meter);
		}		
	});
}

});