var geojson, columndata;
var selectedCanton = null, selectedFeature = null;

// Swiss map projection
var crs = new L.Proj.CRS('EPSG:21781',
  '+title=CH1903 / LV03 +proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs',
  {
    origin: [660000, 190000],
    extent: [420000, 900000, 30000, 350000],
    resolutions: [650.0, 500.0, 250.0, 100.0]
  }
);

// Main map object
var MAP_DEFAULT_CENTER = [46.9, 8.2];
var map = L.map('map')
		   .setView(MAP_DEFAULT_CENTER, 7.5);

//addGeoAdmin();

// Load data files
$.getJSON('data/Entrees_Sorties_Hospitalisations_Suisse_2011.json', function(data) {
	
	//console.log(data);
	columndata = data;

	// Load canton borders
	$.getJSON('data/swiss-cantons.geo.json', 
		function(data) {

			geojson = L.geoJson(data, {
				style: style,
				onEachFeature: onEachFeature
			}).addTo(map);

			map.attributionControl.addAttribution(
				'Données &copy; 2013 <a href="http://www.bfs.admin.ch/bfs/portal/fr/index/themen/14/04/01/data/01/05.html" target="_blank">Office fédéral de la statistique</a>');
		});

});

// control that shows state info on hover
var info = L.control();

info.onAdd = function (map) {
	this._div = L.DomUtil.create('div', 'info');
	this._infobox = $('.infobox.canton').hide();
	this._blankbox = $('.infobox.blank').show();
	this.update();
	return this._div;
};

info.update = function (props) {
	$('.infobox.canton div').css('border-left', '2em solid white');
	if (selectedCanton != null) {
		props = {
			abbr: columndata.Canton[selectedCanton],
			name: columndata.Nom[selectedCanton]
		}
	} else if (props === undefined) {
		$('.infobox.blank').show();
		this._infobox.hide();
		return;
	}
	// colourful
	$('.infobox.canton .patients').css('border-left', 
		'2em solid ' + getColor(getValueForCanton(props.abbr)));
	// update legend
	updateValueForCanton(this._infobox, props.abbr);
	this._blankbox.hide();
	this._infobox.show();
	// update overlay
	/*
	this._div.innerHTML = (props ?
		'<b>' + props.name + '</b><br />'
		+ (getValueForCanton(props.abbr) + '')
		: '...');
	*/
};

info.addTo(map);

function initGeoAdmin(map) {
	var geoadmin = L.tileLayer.wms("http://wms.geo.admin.ch/", {
	    layers: 'ch.swisstopo.pixelkarte-farbe-pk1000.noscale',
	    format: 'image/jpeg',
	    transparent: false,
	    crs: crs,
	    attribution: '&copy; ' +
	          '<a href="http://www.geo.admin.ch/internet/geoportal/en/home.html">' +
	          'Pixelmap 1:1000000 / geo.admin.ch</a>'
	}).addTo(map);
}

function getValueForCanton(abbr) {

	var ix = getIxCanton(abbr);
	return columndata.Entrants[ix];
}

function updateValueForCanton(obj, abbr) {

	var ix = getIxCanton(abbr);
	var name = columndata.Nom[ix];
	var entrants = columndata.Entrants[ix];
	var sortants = columndata.Sortants[ix];
	var locals   = columndata[abbr][ix];

	var p_local 	= locals / entrants;
	var p_remote 	= (sortants-locals) / sortants;
	var p_visitors 	= (entrants-locals) / entrants;

	$('.name', obj).html( name );
	$('.de-name', obj).html( 
		(["VD","TI"].indexOf(abbr) ? 'du' : 'de') + name );
	$('.patients', obj).html( entrants );
	$('.hospitals', obj).html( sortants );
	$('.percent-local', obj).html( parseInt(1000 * p_local) / 10 );
	$('.percent-remote', obj).html( parseInt(1000 * p_remote) / 10 );
	$('.percent-visitors', obj).html( parseInt(1000 * p_visitors) / 10 );

	return true;
}

function getIxCanton(abbr) {
	var data = columndata[abbr];
	if (data === undefined) return null;
	for (var i = 0; i < columndata.Canton.length; i++) {
		if (columndata.Canton[i] == abbr) { return i; }
	}
	return null;
}

// get color depending on population density value
var DATA_GRADES = 
	[1000, 5000, 25000, 50000, 100000];
function getColor(d) {
	return d > DATA_GRADES[7] ? '#800026' :
	       d > DATA_GRADES[6] ? '#BD0026' :
	       d > DATA_GRADES[5] ? '#E31A1C' :
	       d > DATA_GRADES[4] ? '#FC4E2A' :
	       d > DATA_GRADES[3] ? '#FD8D3C' :
	       d > DATA_GRADES[2]   ? '#FEB24C' :
	       d > DATA_GRADES[1]   ? '#FED976' :
	                  '#FFEDA0';
}

function style(feature) {
	var id = feature.properties.abbr;
	return {
		weight: 2,
		opacity: 1,
		color: '#444',
		//dashArray: '3',
		fillOpacity: 0.7,
		fillColor: //'#e99' 
			getColor(getValueForCanton(id))
	};
}

function highlightFeature(e) {
	if (selectedCanton != null) return;
	var layer = e.target;

	layer.setStyle({
		weight: 3,
		color: '#fff',
		dashArray: '',
		fillOpacity: 0.7
	});

	if (!L.Browser.ie && !L.Browser.opera) {
		layer.bringToFront();
	}

	info.update(layer.feature.properties);
}

function resetHighlight(e) {
	if (selectedCanton != null) return;
	geojson.resetStyle(e.target);
	info.update();
}

function zoomToFeature(e) {
	var s = columndata.Canton
			.indexOf(e.target.feature.properties.abbr);
	if (s == selectedCanton) {
		selectedCanton = null;
		map.setView(MAP_DEFAULT_CENTER, 7.5);
	} else {
		selectedCanton = (selectedCanton == null) ? s : null;
		if (selectedFeature != null)
			geojson.resetStyle(selectedFeature);
		selectedFeature = e.target;
		map.fitBounds(e.target.getBounds());
	}
}

function onEachFeature(feature, layer) {
	layer.on({
		mouseover: highlightFeature,
		mouseout: resetHighlight,
		click: zoomToFeature
	});
}

var legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {

	var div = L.DomUtil.create('div', 'info legend'),
		grades = DATA_GRADES,
		labels = [],
		from, to;

	for (var i = 0; i < grades.length; i++) {
		from = grades[i];
		to = grades[i + 1];

		labels.push(
			'<i style="background:' + getColor(from + 1) + '"></i> ' +
			from + (to ? '&ndash;' + to : '+'));
	}

	div.innerHTML = labels.join('<br>');
	return div;
};

legend.addTo(map);