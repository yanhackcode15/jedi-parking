// Place all the behaviors and hooks related to the matching controller here.
// All this logic will automatically be available in application.js.
"use strict";
window.addEventListener('load', function(){

window.smartParking = window.smartParking || {};
var infowindow;
var map;
var markers = [];
var meters = [];
var myMarker;
var watchId;
var destination={};
var currentPos={};


getMeters()
.catch(console.error.bind(console));

getCurrentAddress()
.then(function(response){
	currentPos = response;
	return geocodeSearchAddress(smartParking.searchAddress);
})
.then(function(response) {
	if (response==null){
		return;
	}
	destination=response; 	
	showDir(map, currentPos, destination);
})
.catch(alert);

function getMeters(){
	return new Promise(function(resolve, reject){
		$.ajax({
			'url': "/meters",
			'dataType': "json"
		})
		.done(resolve)
		.fail(reject);
	})
	.then(function (data) {
		meters = [];
		for(var i=0; i<data.length; i++){
			var meter = {
				address: data[i].address,
				latitude: data[i].latitude,
				longitude: data[i].longitude,
				meter_id: data[i].meter_id,
				event_type: data[i].event_type,
				event_time: data[i].event_time,
				position: new google.maps.LatLng(data[i].latitude, data[i].longitude)
			};
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
				position: meter.position,
				icon: icon
			});

			google.maps.event.addListener(meter.marker, 'click', (function(marker, address) {
				return function() {
					infowindow.setContent(address);
					infowindow.open(map, marker);
				}
			})(meter.marker, meter.address));
			meters.push(meter);
		}

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
		
		infowindow = new google.maps.InfoWindow();
		
		map = initMap();
		

		var icon = {
			path: google.maps.SymbolPath.CIRCLE,
			scale: 5,
			fillColor: 'orange',
			strokeColor: 'orange',
			strokeWeight: 2,
			fillOpacity: 0.8
		};
		myMarker = new google.maps.Marker({icon: icon, map: map});

		currentPos=loadGeo();
		

		google.maps.event.addListener(map, 'idle', showMeterMarkers);
	});
}

function showMeterMarkers() {
	var bounds = map.getBounds();
	// Update meters to show only if they are within the bounds
	for (var i = 0; i < meters.length; i++) { 
		var meter = meters[i];
		if (!bounds.contains(meter.position)){
			meter.marker.setMap(null);
		} else if (meter.marker.getMap() !== map) {
			meter.marker.setMap(map);
		}
	}
}


function handleLocationError(browserHasGeolocation, infoWindow, pos) {
	infoWindow.setPosition(pos);
	infoWindow.setContent(browserHasGeolocation ?
		'Error: The Geolocation service failed.' :
		'Error: Your browser doesn\'t support geolocation.');
}

function initMap() {
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
	var map = new google.maps.Map(mapDiv, mapOptions);
	map.mapTypes.set('map_style', styledMap);
	map.setMapTypeId('map_style');

	document.getElementById('mapContainer').appendChild(mapDiv);
	return map;
}

function loadGeo(){     
	var infoWindow = new google.maps.InfoWindow({map: map});
		// Try HTML5 geolocation.
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(function(position) {
			var pos = {
				lat: position.coords.latitude,
				lng: position.coords.longitude
			};
			// debugger;
			infoWindow.setPosition(pos);
			infoWindow.setContent('You are here!');
			return pos;
			// map.setCenter(pos);
		}, function() {
			handleLocationError(true, infoWindow, map.getCenter());
		});
	} else {
		// Browser doesn't support Geolocation
		handleLocationError(false, infoWindow, map.getCenter());
	}
}

function showDir(map, orig, dest){

	var directionsService = new google.maps.DirectionsService();
	var directionsDisplay = new google.maps.DirectionsRenderer;
	directionsDisplay.setMap(map);
	
	calcRoute(orig, dest);

	function calcRoute(orig, dest) {
		console.log(orig);
		console.log(dest);
		var request = {
			origin:orig,
			destination:dest,
			travelMode: google.maps.TravelMode.DRIVING
		};
		directionsService.route(request, function(result, status) {
			if (status == google.maps.DirectionsStatus.OK) {
				directionsDisplay.setDirections(result);
			}
		});
	}
}

function geocodeSearchAddress(address) {
	return new Promise(function (resolve, reject) {
		if (""+address==""){
			return resolve();
		}
		var geocoder = new google.maps.Geocoder();
		geocoder.geocode({ address: address }, function (results, status) {
			if (status !== google.maps.GeocoderStatus.OK) {
				return reject('The address is either invalid or is not specific enough.');
			}

			var address = results[0].formatted_address;
			var lat = results[0].geometry.location.lat();
			var lng = results[0].geometry.location.lng();
			var location = {lat: lat, lng: lng};

			var numCommas = address.match(/,/g).length;
			if (numCommas >= 3) {
				address = address.replace(/, USA$/, '');
				document.getElementById('address').value = address;
			}
			
			resolve(location);
		});
	});
}

function getCurrentAddress(map) {
	return new Promise(function (resolve, reject){
		var infoWindow = new google.maps.InfoWindow({map: map});
		// Try HTML5 geolocation.
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function(position) {
				var pos = {
					lat: position.coords.latitude,
					lng: position.coords.longitude
				};
				// debugger;
				infoWindow.setPosition(pos);
				infoWindow.setContent('You are here!');
				resolve(pos);
				// map.setCenter(pos);
			}, function() {
				handleLocationError(true, infoWindow, map.getCenter());
			});
		} else {
			// Browser doesn't support Geolocation
			handleLocationError(false, infoWindow, map.getCenter());
		}
	});
}

});