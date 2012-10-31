module('Mask.Renderer');
test('scope',function(){
	var scope = Mask.Renderer.scope({a:1,b:2,"c.d":{e:"f"}})
	equal(scope.data('a'),1);
	equal(scope.data('b'),2);
	deepEqual(scope.data('c.d'),{e:"f"});

	scope = Mask.Renderer.scope({a:2,"c":{e:"f"}},scope)
	deepEqual(scope.data('c.d'),{e:"f"});
	deepEqual(scope.data('c'),{e:"f"});
	equal(scope.data('a'),2);
	equal(scope.data('b'),2);
});



module('maskJS');
test('logicless',function(){
	var template = Mask.t(
		"<!--defMarker/-->\n<!--dynMarker/-->\n<ul class=\"{{ top }}\">\n  <!--item-->\n  <li class=\"{{nested}}\">{{i}}: {{text}} - the {{i}} is rendered twice</li>{{unusedMarkerWillDisappear}}\n  <!--/item-->\n</ul>",
		{
			pattern:{
				"default":	{token:'{{%s%logic%s}}'},
				"singleHtml":	{token:'<!--%s%logic%s/-->', priority:1},
				"html":		{token:'%ls<!--%s%logic%s-->%n%tmp%ls<!--%s/%id%s-->%n'}
			},
			cache:false,
			data:{
				defMarker:"I'm not given in the data object!",
				dynMarker:function(){return "I'm rendered dynamically by a function!";}
			}
		}
	);
	equal(
		template.render({
			top:'top',
			text:'scope level 1 data',
			item:[
				{nested:'nested1'},
				{nested:'nested2', text:'scope level 2 data'},
				{nested:'nested3'}
			],
			unusedData:'???'
		}),
		"I'm not given in the data object!\nI'm rendered dynamically by a function!\n<ul class=\"top\">\n  <li class=\"nested1\">0: scope level 1 data - the 0 is rendered twice</li>\n  <li class=\"nested2\">1: scope level 2 data - the 1 is rendered twice</li>\n  <li class=\"nested3\">2: scope level 1 data - the 2 is rendered twice</li>\n</ul>"
	)
});
