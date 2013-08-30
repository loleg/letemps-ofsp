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
	
	// clear selection
	$('.infobox.canton .colorbox').css({ 'border':'2px solid white', 'background':'#fff' });

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

var barchart, barchart_options = {
		scaleLineColor : "rgba(0,0,0,1)",
		scaleFontFamily : "'Lucida Grande','Lucida Sans Unicode','Arial','Verdana','sans-serif'",
		scaleLabel : "<%=value%>%",	
		scaleFontSize : 11,
		scaleFontColor : "#999",
		scaleShowGridLines : false,
		animation : false
};

function initChart() {
	var ctx = $('#barchart').get(0).getContext("2d");
	barchart = new Chart(ctx);
}

function precalcValues() {
	columndata.Summary = {};
	for (var i = 0; i < columndata.Canton.length; i++) {
		var abbr = columndata.Canton[i];
		if (abbr.length > 2) continue;
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

function addCommas(str) {
    var amount = (new String(str)).split("").reverse(), output = "";
    $.each(amount, function(i) {
        output = this + output;
        if ((i+1) % 3 == 0 && (amount.length-1) !== i)
        	output = ' ' + output;
    });
    return output;
}

function updateValueForCanton(obj, abbr) {
	var data = columndata.Summary[abbr];

	// update numbers
	
	$('.name', obj).html( data.name );
	$('.de-name', obj).html( 
		(["VD","TI"].indexOf(abbr) ? 'du' : 'de') + data.name );
	$('.patients', obj).html( addCommas(data.entrants) );
	$('.hospitals', obj).html( addCommas(data.sortants) );
	$('.percent-local', obj).html( parseInt(1000 * data.p_local) / 10 );
	$('.percent-remote', obj).html( parseInt(1000 * data.p_remote) / 10 );
	$('.percent-visitors', obj).html( parseInt(1000 * data.p_visitors) / 10 );

	// update colors

	$('.box-percent-local', obj).css('background-color', COLOR_HOVER); 
	$('.box-percent-remote', obj).css('background-color', 
		getColor(100 * data.p_remote) );
	$('.box-percent-visitors', obj).css('border',
		'2px solid ' + getColor(100 * data.p_visitors) );

	// update chart
	var barchart_data = {
			labels: [],
			datasets: [{ 
				data: [], fillColor: "#cc1030", strokeColor : "#ffffff",
			},{
				data: [], fillColor: "#ffffff", strokeColor : "#cc1030"
			}]
		};
	var cantonsorted = 
		columndata.Canton
			.slice(0, columndata.Canton.length-1)
			.sort(function(a,b) {
				return getCantonFromTo(abbr, b) - getCantonFromTo(abbr, a);
			});
	$.each(cantonsorted, function(i) {
		if ( this == abbr ) return;
		var fromto = getCantonFromTo(abbr, this),
			tofrom = getCantonToFrom(abbr, this);
		fromto = (fromto < .1) ? 0 : fromto;
		tofrom = (tofrom < .1) ? 0 : tofrom;
		if ( fromto + tofrom < .1 ) return;
		barchart_data.labels.push( this );
		barchart_data.datasets[0].data.push( fromto * 100 );
		barchart_data.datasets[1].data.push( tofrom * 100 );
	});
	
	//console.log(barchart_data);
	barchart.Bar(barchart_data, barchart_options);

	return true;
}

function getCantonFromTo(abbrFrom, abbrTo) {
	return columndata[abbrFrom][getIxCanton(abbrTo)] / 
		   columndata.Summary[abbrFrom].remote;
}

function getCantonToFrom(abbrFrom, abbrTo) {
	return columndata[abbrTo][getIxCanton(abbrFrom)] / 
		   columndata.Summary[abbrTo].remote;
}

// get color depending on population density value
var DATA_SCALES = [
		[35, 50, 75, 85, 90, 99],
		[0, 5, 10, 20, 30, 40]
	];
var DATA_GRADES = DATA_SCALES[0];
var COLOR_HOVER = "#fe9";

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
			getColor( 
				getValueForCanton( 
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
		var fromto = getCantonFromTo(
						layer.feature.properties.abbr, 
						this.feature.properties.abbr ),
			tofrom = getCantonToFrom(
						layer.feature.properties.abbr, 
						this.feature.properties.abbr );
		this.setStyle({ 
			fillColor: 	getColor(100 * fromto),
			color: 		getColor(100 * tofrom),
			weight: 	(tofrom < 0.11) ? 0 : 2
		});
	});

	// this
	layer.setStyle({ color: '#fff', fillColor: COLOR_HOVER });

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

initChart();

switchScale(0);