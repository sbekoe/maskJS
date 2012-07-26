var tests = [
	{
		name:"full test",
		template:
			'<!--defMarker/-->' +
			'<!--dynMarker/-->' +
			'<ul class="{{ top }}">\n' +
				'<!--item-->' +
				'\t<li class="{{itemClass}}">{{i}}: {{itemName}} - the {{i}} is rendered twice</li>' +
				'{{unusedMarkerWillDisappear}}' +
				'<!--/item-->' +
			'</ul>',
		options:{
			pattern:['{{%s%id%s}}', '{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],
			cache:false,
			marker:{
				defMarker:"I'm not given in the data object!",
				dynMarker:function () {
					return "I'm rendered dynamically by a function!";
				}
			}
		},
		result:
			"I'm not given in the data object!"+
			"I'm rendered dynamically by a function!"+
			"<ul class="">"+
				"<li class="li">0: list element - the 0 is rendered twice</li>"+
				"<li class="li extra class">1: another list element - the 1 is rendered twice</li>"+
			"</ul>"
	}
];

test( "full test", function() {
	ok( true, "true succeeds" );
	ok( "non-empty", "non-empty string succeeds" );

	ok( false, "false fails" );
	ok( 0, "0 fails" );
	ok( NaN, "NaN fails" );
	ok( "", "empty string fails" );
	ok( null, "null fails" );
	ok( undefined, "undefined fails" );
});


var tmp = Mask.t(
	'<!--defMarker/-->\n' +
		'<!--dynMarker/-->\n' +
		'<ul class="{{ top }}">\n' +
		'<!--item-->\n' +
		'\t<li class="{{itemClass}}">{{i}}: {{itemName}} - the {{i}} is rendered twice</li> ' +
		'{{unusedMarkerWillDisappear}}' +
		'<!--/item-->\n' +
		'</ul>\n',
	{
		pattern:['{{%s%id%s}}', '{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],
		cache:false,
		marker:{
			defMarker:"I'm not given in the data object!",
			dynMarker:function () {
				return "I'm rendered dynamically by a function!";
			}
		}
	}
);

console.log(tmp.render({
	listClass:'ul',
	itemClass:'li',
	item:[
		{itemName:'list element'},
		{itemClass:'li extra class', itemName:'another list element'}
	],
	unusedData:'???'
}));
console.log(tmp);

$('.test').after('<pre>["test","' + $('[name="template"]').text().replace(/"/g,'\\"') + '",' + $('[name="options"]').text() + ',"' + $('[name="result"]').text().replace(/"/g,'\\"') + '"</pre>');