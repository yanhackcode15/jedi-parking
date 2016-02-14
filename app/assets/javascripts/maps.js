// Place all the behaviors and hooks related to the matching controller here.
// All this logic will automatically be available in application.js.
"use strict";
window.addEventListener('load', function(){

window.smartParking = window.smartParking || {};
var infoWindow;
var map;
var markers = [];
var meters = [];
var myMarker;
var watchId;
var currentPos;
var currentZoom;
var destinationMarker;
var destinationPos;
var directionsDisplay;


var t = Date.now();
function timer(){
	var message = Array.apply(null, arguments);
	var tx = t;
	t = Date.now();
	var Δt = t - tx;
	message.push('Δt:' + Δt);
	console.log.apply(console, message);
}

initMap()
.then(function(){
	getMeters();
	return Promise.all([
		getCurrentPosition(),
		geocodeSearchAddress()
	]);
})
.then(showRoute)
.catch(console.error.bind(console));



function getMeters(){
	return new Promise(function(resolve, reject){
		timer('getMeters');
		// if (localStorage.meters && localStorage.meters.length) {
		// 	meters = localStorage.meters;
		// 	timer('getMeters using localStorage');
		// 	return resolve(meters);
		// }

		$.ajax({
			'url': "/meters",
			'dataType': "json"
		})
		.complete(resolve)
		.fail(reject);
	})
	.then(function (data) {
		timer('getMeters callback');
		meters = [];
		for(var i=0; i<data.length; i++){
			var meter = {
				address: data[i].address,
				latitude: data[i].latitude,
				longitude: data[i].longitude,
				meter_id: data[i].meter_id,
				event_type: data[i].event_type,
				event_time: data[i].event_time,
				latlng: new google.maps.LatLng(data[i].latitude, data[i].longitude)
			};
			meters.push(meter);
		}
		localStorage.meters = meters;

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
		timer('getMeters callback finished');
	});
}

function showMeterMarkers() {
	//wrap all these inside a zoom condition so this function will only execute if zoom is less than a value
	//retrieve current zoom
	timer('showMeterMarkers');
	currentZoom = map.getZoom();
	var bounds = map.getBounds();
	var displayedCount = 0;
	// Update meters to show only if they are within the bounds
	for (var i = 0; i < meters.length; i++) { 
		if (i > 7000) debugger;
		var meter = meters[i];
		if (!bounds.contains(meter.latlng) || currentZoom < 18){
			// Only show meters when zoomed in close enough and are actually within the display area.
			if (meter.marker) {
				meter.marker.setMap(null);
			}
		} else {
			// Set up the meter marker for only meters that will be displayed
			++displayedCount;
			if (!meter.marker){
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

				google.maps.event.addListener(meter.marker, 'click', (function (marker, address) {
					return function () {
						infoWindow.setContent(address);
						infoWindow.open(map, marker);
					}
				})(meter.marker, meter.address));
			}
			if( meter.marker.getMap() !== map){
				meter.marker.setMap(map);	
			}
		}
	}
	timer('showMeterMarkers', 'zoom: '+currentZoom, 'showing ' + displayedCount+' (of '+meters.length+' total meters)');
}


function handleLocationError(message) {
	infoWindow.setPosition(pos);
	infoWindow.setContent(message);
}

function initMap() {
	return new Promise(function (resolve, reject){
		timer('initMap');
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
		timer('initMap finished');
		resolve();
	});
}


function showRoute(){
	return new Promise(function (resolve, reject) {
		timer('showRoute');
		if (!currentPos || !destinationPos) {
			resolve();
		}
		var directionsService = new google.maps.DirectionsService();
		var request = {
			origin: currentPos,
			destination: destinationPos,
			travelMode: google.maps.TravelMode.DRIVING
		};
		directionsService.route(request, function(directions, status) {
			timer('showRoute callback');
			if (status == google.maps.DirectionsStatus.OK) {
				directionsDisplay = new google.maps.DirectionsRenderer({map: map, directions: directions});
			}
			timer('showRoute callback finished');
			resolve();
		});
	});
}

function geocodeSearchAddress() {
	return new Promise(function (resolve, reject) {
		timer('geocodeSearchAddress');

		var address = smartParking.searchAddress;
		if (''+address == ''){
			return resolve();
		}
		var geocoder = new google.maps.Geocoder();
		geocoder.geocode({ address: address }, function (results, status) {
			timer('geocodeSearchAddress callback');
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
			timer('geocodeSearchAddress callback finished');
			resolve();
		});
	});
}

function getCurrentPosition() {
	return new Promise(function (resolve, reject){
		timer('getCurrentPosition');
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function(position) {
				timer('getCurrentPosition callback');
				currentPos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
				infoWindow.setPosition(currentPos);
				infoWindow.setContent('You are here!');
				timer('getCurrentPosition callback finished');
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
	timer('removeMeterZoomingOut');
	currentZoom = map.getZoom();
	console.info('Zoom:',currentZoom);
	var meter;
	if (currentZoom<18){
		for (var i = 0; i < meters.length; i++){
			meter = meters[i];
			if (meter.marker!=null){
				meter.marker.setMap(null);
			}
		}
	}
}

function countMetersInArea(destination) {
	//cal the number of available and vacant parkings within half a mile walking from the destination
	timer('countMetersInArea');
	var counts = {'meterCount': 0, 'availMeterCount': 0};
	var lat2 = destination.lat();
	var lng2 = destination.lng();
	for(var i=0; i<meters.length; ++i) {
		timer('countMetersInArea', i);
		var meter = meters[i]
		var distance = getDistance(meter.latlng.lat(), meter.latlng.lng(), lat2, lng2);
		if (distance <= 0.25) {
			counts.meterCount += 1;
			if (meter.event_type != 'SS') {
				counts.availMeterCount += 1;
			}
		}
	}
	return counts;
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

function updateDirections(destination) {
	//when user is close to the desitnation (0.25 miles away), run algo to determine the meter to route user to.
}

});