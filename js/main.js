// welcome to beantown
var center = {lat: 42.36, lng: -71.08};
var map;
var markers = [];

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: center,
      zoom: 14
    });
}

function mapError() {
	console.log("Error loading map");
    var notification = document.querySelector('.mdl-js-snackbar');
    notification.MaterialSnackbar.showSnackbar({message: 'Could not load map. Please try again.'});
};

function addMarker(place) {
    var contentString = '<div id="content">'+
          '<div id="siteNotice"></div>'+
          '<h1 id="firstHeading" class="firstHeading">' + place.name +
          '</h1><div id="bodyContent">'+
          place.review_count + ' Reviews | ' + '<img src="' + place.rating_img_url +
          '" alt="rating"><hr><p>' + place.snippet_text + '</p>' +
          '<p><b>Phone: </b>' + place.display_phone +
          '<p><b>Address: </b>' + place.location.display_address.join(" ") + '</p>'+
          '<a href="' + place.url +'">Website</a>' +
          '</p></div></div>';

    var infowindow = new google.maps.InfoWindow({
        content: contentString
    });
    
    var marker = new google.maps.Marker({
        position: {lat:place.location.coordinate.latitude, lng:place.location.coordinate.longitude},
        map: map
    });
    
    marker.addListener('click', function() {
        infowindow.open(map, marker);
        animate(marker);
    });

    map.addListener('click', function() {
        infowindow.close(map, marker);
    });
    
    markers.push(marker)

}

function setMapOnAll(map) {
    for (var i = 0; i < markers.length; i++) {
      markers[i].setMap(map);
    }
}

// Removes the markers from the map, but keeps them in the array.
function clearMarkers() {
    setMapOnAll(null);
}

// Shows any markers currently in the array.
function showAllMarkers() {
    setMapOnAll(map);
}

// shows one marker
function showMarker(marker) {
	marker.setMap(map)
}


// Deletes all markers in the array by removing references to them.
function deleteMarkers() {
    clearMarkers();
    markers = [];
}


function cb(data) {
    console.log('hello...');
}

function markerFilter(coord, m) {
    for(var i = 0; i < m.length; i++) {
        if (m[i].position.lat().toFixed(13) === coord.latitude.toFixed(13) && m[i].position.lng().toFixed(13) === coord.longitude.toFixed(13)) {
            return m[i];
        } 
    }
}

function animate(marker) {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(function(){marker.setAnimation(null);}, 700);
}

//  main app
function Location(data) {
    var self = this;
    self.showDetails = ko.observable(false);
    self.isVisible = ko.observable(true);


    self.name = ko.observable(data.name);
    self.address = ko.observable(data.location.address);
    self.city = data.location.city;
    self.center = ko.observable(data.location.coordinate);
    self.rating_img = data.rating_img_url_large;
    self.num_ratings = data.review_count;
    self.phone = ko.observable(data.display_phone);
    self.url = data.url;
    self.image = data.image_url;

    self.toggleVisibility = function() {
    	self.isVisible(!self.isVisible());
    }

    self.toggleInfo = function() {
        self.showDetails(!self.showDetails());
    }

    self.displayInfo = ko.computed(function() {
        if (self.showDetails()) {
            // animate marker and display info
            animate(markerFilter(self.center(), markers));
            return self.name() + '<hr><ul><li>' + self.phone() + '</li><li>' + self.address() + '</li></ul>';
        } else {
            return self.name();
        }
    });
}

function ViewModel() {
    var self = this;
    self.query = ko.observable('');
    self.locations = ko.observableArray([]);
    self.markers = ko.observableArray([]);
    self.filterInput = ko.observable('');

    // modified hack around yelp api v2 cors block courtesy of:
    // https://gist.github.com/mnemonicflow/1b90ef0d294c692d24458b8378054c81
    // todo: upgrade to api v3
    self.yelpSearch = function(query) {
        var auth = {
            // Update with your auth tokens.
            consumerKey : "zMiWRLyNndWvmOsyA1Y3gQ",
            consumerSecret : "gWYPzYjf38LLI7-DUzTYiLcaCNg",
            accessToken : "eIVlS5yuN8zlYOrEAfkMHBTDi9SbI9eo",
            // This example is a proof of concept, for how to use the Yelp v2 API with javascript.
            // You wouldn't actually want to expose your access token secret like this in a real application.... but this is a udacity project so lulz it is
            accessTokenSecret : "ekIo1SCq4Izfa-kPukRTSZdCw5E",
            serviceProvider : {
                signatureMethod : "HMAC-SHA1"
            }
        };
        

        var accessor = {
            consumerSecret : auth.consumerSecret,
            tokenSecret : auth.accessTokenSecret
        };

        var q = query.split(" in ");
        var terms = q[0];
        var near = q[1];

        var parameters = [];
        parameters.push(['term', terms]);
        parameters.push(['location', near]);
        parameters.push(['limit', 8]);
        parameters.push(['callback', 'cb']);
        parameters.push(['oauth_consumer_key', auth.consumerKey]);
        parameters.push(['oauth_consumer_secret', auth.consumerSecret]);
        parameters.push(['oauth_token', auth.accessToken]);
        parameters.push(['oauth_signature_method', 'HMAC-SHA1']);

        var message = {
            'action' : 'https://api.yelp.com/v2/search',
            'method' : 'GET',
            'parameters' : parameters
        };

        OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message, accessor);

        var parameterMap = OAuth.getParameterMap(message.parameters);
            
        $.ajax({
            'url' : message.action,
            'data' : parameterMap,
            'dataType' : 'jsonp',
            'jsonpCallback' : 'cb',
            'cache': true
        })
        .done(function(data, textStatus, jqXHR) {
            // pan map
            search_location = {lat:jqXHR.responseJSON.region.center.latitude, lng: jqXHR.responseJSON.region.center.longitude}
            map.panTo(search_location)
            
            // drop markers
            for (var i = 0; i < jqXHR.responseJSON.businesses.length; i++) {
                self.locations.push(new Location(jqXHR.responseJSON.businesses[i]));
                addMarker(jqXHR.responseJSON.businesses[i]);
            }

        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.log('error[' + errorThrown + '], status[' + textStatus + '], jqXHR[' + JSON.stringify(jqXHR) + ']');
            var notification = document.querySelector('.mdl-js-snackbar');
            notification.MaterialSnackbar.showSnackbar({message: 'Could not load results. Please try again.'}
            );
        })
    }

    // clear prev & get results
    self.fetchResults = function() {
        self.locations.removeAll();
        deleteMarkers();
        self.yelpSearch(self.query());
    }

    self.luckyResults = function() {
        var queries = ['cafes', 'coffee', 'bars', 'tacos', 'ice cream', 'burgers', 'pizza', 'sushi'];
        var places = ['cambridge', 'boston', 'seattle', 'san francisco', 'palo alto', 'portland', 'atlanta', 'denver'];

        var q = queries[Math.floor(Math.random() * queries.length)];
        var loc = places[Math.floor(Math.random() * places.length)];

        // format random choice and fetch results
        var query = q + " in " + loc;
        self.locations.removeAll();
        deleteMarkers();
        self.yelpSearch(query);
    }

    self.filteredLocations = ko.computed(function() {
    	if (self.filterInput() != '') {
    		clearMarkers()
    		return ko.utils.arrayFilter(self.locations(), function(location) {
    			if (location.name().toLowerCase().startsWith(self.filterInput().toLowerCase())) {
    				showMarker(markerFilter(location.center(), markers));
    			}
    			return location.name().toLowerCase().startsWith(self.filterInput().toLowerCase());
    		});
    	} else {
    		showAllMarkers()
    		return self.locations()
    	}
    }, self);

}

ko.applyBindings(new ViewModel());