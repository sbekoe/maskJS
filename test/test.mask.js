module('Mask');
//*
test('compile()', function(){
  var mask = new Mask({
    pattern: {
      "mustache": {
        token: '{{ ? }}|{{ /? }}',
        trimBlockBound : true
      }
    },

    marker: {
      'if':{
        exp: '(#param:if|elseif|else|endif)%s(#param:%path)%s(#op:==|!=|<|>|<=|>=)%s(#param:%path)|(#param:(#namespace:if))',
        priority: 5,
        translator: function(abstract, key){
          return "$.handle('" + abstract.token[0]['$namespace'] + "')";
        }
      },
      'with': {
        exp: 'with test',
        priority: 4
      }
    },

    templates:{
      'getData': function(){ $.getData('_PATH_') }
//      'if': function(){ ($.getData('_PATH1_') || '_PATH1_' _COND_ $.getData('_PATH2_') || '_PATH2_')? _CONTENT_ :}
    },

    on:{
      'parse:if': function(token, abstract, behaviour) {
        var
          key = token.param[0],
          type = token.type,
          length = abstract.token.length,
          validCloser = length === 0 && type === 'closer' && key === 'if',
          validOpener = type === 'opener' && abstract.token[0].marker === 'if'  && ( (length === 1 && key === 'else') || (length && (key === 'if' || key === 'elseif')) );

        behaviour.valid = behaviour.valid && (validCloser || validOpener);

        if(!behaviour.valid) return;

        behaviour.complete = behaviour.complete && key === 'if';

      },
      'generate:block:if': function(e){
        var
          param = e.token.param;
        if(param[0] === 'if' || param[0] === 'elseif') return '($.getData("'+'")' + + ')'
      }
    },

    cache:false
  });

  mask.compile('{{if cond==1 with test}} {{foo}} {{elseif cond==2}} {{bar}} {{/if}}')
  var content = mask.abstract.content,
    contentExists = content[0] && typeof content[0][0] === 'object';
  ok(contentExists && content[0][0].content.length === 2);
  ok(contentExists && content[0][0].token.length === 3);


});
//*/

//*
test('render()', function(){
  var mask = new Mask({
    pattern: {
      "mustache":	{
        token:'{{ ? }}'
      },
      "html": {
//        token: '%ls<!-- ? -->%n|%ls<!-- /%id -->%n'
        token: '<!-- ? -->|<!-- /%id -->',
        trimBlockBound : true
      }
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

//*/