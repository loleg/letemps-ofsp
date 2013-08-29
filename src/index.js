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
var MAP_DEFAULT_CENTER = [46.8, 8.2];
var map = L.map('map')
		   .setView(MAP_DEFAULT_CENTER, 7.5);

//addGeoAdmin();

// Load data files
$.getJSON('data/Entrees_Sorties_Hospitalisations_Suisse_2011.json', function(data) {
	
	//console.log(data);
	columndata = data;
	precalcValues();

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

	// colourful box in legend
	$('.infobox.canton .percent-local').css('border-left', 
		'2em solid ' + columndata.Summary[props.abbr].color_start );

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

function precalcValues() {
	columndata.Summary = {};
	for (var i = 0; i < columndata.Canton.length; i++) {
		var abbr = columndata.Canton[i];
		if (typeof columndata[abbr] == 'undefined') continue;
		var data = {
			ix: 		i,
			name: 		columndata.Nom[i],
			entrants:	columndata.Entrants[i],
			sortants:	columndata.Sortants[i],
			locals:		columndata[abbr][i]
		};
		data.remote = data.sortants-data.locals;
		data.p_local = data.locals / data.entrants;
		data.p_remote = data.remote / data.sortants;
		data.p_visitors = (data.entrants-data.locals) / data.entrants;
		data.color_start = getColor(data.p_local * 100);
		// set
		columndata.Summary[abbr] = data;
	}
}

function getIxCanton(abbr) {
	return columndata.Summary[abbr].ix;
}

function getValueForCanton(abbr) {
	return columndata.Summary[abbr].p_local * 100;
}

function updateValueForCanton(obj, abbr) {
	var data = columndata.Summary[abbr];
	
	$('.name', obj).html( data.name );
	$('.de-name', obj).html( 
		(["VD","TI"].indexOf(abbr) ? 'du' : 'de') + data.name );
	$('.patients', obj).html( data.entrants );
	$('.hospitals', obj).html( data.sortants );
	$('.percent-local', obj).html( parseInt(1000 * data.p_local) / 10 );
	$('.percent-remote', obj).html( parseInt(1000 * data.p_remote) / 10 );
	$('.percent-visitors', obj).html( parseInt(1000 * data.p_visitors) / 10 );

	return true;
}

function getColorCantonCanton(abbrFrom, abbrTo) {
	return getColor(100 *
			columndata[abbrFrom][getIxCanton(abbrTo)] / 
			columndata.Summary[abbrFrom].remote
		);
}

// get color depending on population density value
var DATA_SCALES = [
		[35, 50, 75, 85, 90, 99],
		[0, 5, 10, 20, 30, 40]
	];
var DATA_GRADES = DATA_SCALES[0];

function getColor(d) {
	return d > DATA_GRADES[5] ? '#cc1030' :
		   d > DATA_GRADES[4] ? '#940727' :
	       d > DATA_GRADES[3] ? '#a52d49' :
	       d > DATA_GRADES[2] ? '#c57889' :
	       d > DATA_GRADES[1] ? '#ebd1d8' :
	                  			'#ffffff';
}

function style(feature) {
	var baseColor =
		getColor(getValueForCanton(
			feature.properties.abbr ));
	return {
		weight: 2,
		opacity: 1,
		color: '#444',
		//dashArray: '3',
		fillOpacity: 0.7,
		fillColor: baseColor
	};
}

function highlightFeature(e) {
	if (selectedCanton != null) return;
	var layer = e.target;

	switchScale(1);

	// others
	$.each(geojson.getLayers(), function() {
		if (layer == this) return;
		this.setStyle({ 
			fillColor: getColorCantonCanton(
				layer.feature.properties.abbr, 
				this.feature.properties.abbr ) 
		});
	});

	// this
	layer.setStyle({ color: '#fff', fillColor: getColor(100) });

	if (!L.Browser.ie && !L.Browser.opera) {
		layer.bringToFront();
	}

	info.update(layer.feature.properties);
}

function resetHighlight(e) {
	if (selectedCanton != null) return;

	switchScale(0);
	
	$.each(geojson.getLayers(), function() {
		geojson.resetStyle(this);
	});

	geojson.resetStyle(e.target);

	info.update();
}

function zoomToFeature(e) {
	var prevCanton = selectedCanton;
	selectedCanton = null;
	highlightFeature(e);
	var s = columndata.Canton
			.indexOf(e.target.feature.properties.abbr);
	if (s == prevCanton) {
		map.setView(MAP_DEFAULT_CENTER, 7.5);
	} else {
		selectedCanton = s;
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

function switchScale(ds) {
	DATA_GRADES = DATA_SCALES[ds];
	$('.info.legend .grade').hide();
	$('.info.legend .scale-' + ds).show();
}

var legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {

	var div = L.DomUtil.create('div', 'info legend');
	var scales = "<h3>%</h3>";

	for (var ds = 0; ds < DATA_SCALES.length; ds++) {

		DATA_GRADES = DATA_SCALES[ds];
		var grades = DATA_GRADES,
			labels = [],
			from, to;

		for (var i = 0; i < grades.length; i++) {
			from = grades[i];
			to = grades[i + 1];

			labels.push(
				'<i style="background:' + getColor(from + 1) + '"></i> ' +
				from + (to ? '&ndash;' + to : '+'));
		}

		scales += '<div class="grade scale-' + ds + '">'
				+ labels.join('<br>') + '</div>';

	}

	div.innerHTML = scales;
	return div;
};

legend.addTo(map);
switchScale(0);