module('Mask');

test('render()', function(){
  var mask = new Mask({
    pattern:{
      "mustache":	{token:'{{%s%logic%s}}'},
      "singleHtml":	{token:'<!--%s%logic%s/-->', priority:1},
      "html":		{token:'%ls<!--%s%logic%s-->%n%tmp%ls<!--%s/%id%s-->%n'}
      /*
      ,"html":		{
        pattern:'<!-- #if%logic -->|<!-- /%id -->',
        valid: function(abtract){
          return abstract.token[0].name
        }
      }
      //*/
    },
    cache:false
  });

  mask.register(
    "<ul class=\"{{ top }}\">\n  <!--item-->\n  <li class=\"{{nested}}\">{{i}}: {{text}} - the {{i}} is rendered twice</li>{{unusedMarkerWillDisappear}}\n  <!--/item-->\n</ul>"
  );

  var root = mask.create('root'),
    data = {
      top:'top',
      text:'scope level 1 data',
      item:[
        {nested:'nested1'},
        {nested:'nested2', text:'scope level 2 data'},
        {nested:'nested3'}
      ],
      unusedData:'???'
    };
  equal(
    root.render(data),
    "<ul class=\"top\">\n  <li class=\"nested1\">0: scope level 1 data - the 0 is rendered twice</li>\n  <li class=\"nested2\">1: scope level 2 data - the 1 is rendered twice</li>\n  <li class=\"nested3\">2: scope level 1 data - the 2 is rendered twice</li>\n</ul>"
  );
});