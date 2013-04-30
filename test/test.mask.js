module('Mask');
//*
test('compile()', function(){
  var api = {
    eventParseSyntaxMustache: 0
  };
  var mask = new Mask({
    syntax: [
     { skey: 'mustache', token: '{{ ? }}|{{ /? }}', trimBlockBound : true }
    ],

    logic: [
      { lkey:'if', exp: '(#param:if|elseif|else|endif)%s(#param,namespace:%path)%s(#op:==|!=|<|>|<=|>=)%s(#param:%path)|(#param:(#namespace:if))', priority: 5 },
      { lkey:'with', exp: 'with (#param:%path)', priority: 4 }
    ],

    templates:{
      'getData': function(){ $.getData('_PATH_') }
//      'if': function(){ ($.getData('_PATH1_') || '_PATH1_' _COND_ $.getData('_PATH2_') || '_PATH2_')? _CONTENT_ :}
    },

    on:{
      'parse:logic:if': function(token, abstract, behaviour) {
        var
          key = token.cap('param'),
          type = token.atm('type'),
          length = abstract.token.length,
          validCloser = length === 0 && type === 'closer' && key === 'if',
          validOpener = type === 'opener' && ( (length === 1 && key === 'else') || (length && (key === 'if' || key === 'elseif')) ) && abstract.token[0].atm('lkey') === 'if' ;

        behaviour.valid = behaviour.valid && (validCloser || validOpener);

        if(!behaviour.valid) return;

        // behaviour.complete = behaviour.complete && type === 'opener';
        behaviour.complete = behaviour.complete && key === 'if';

      },


      'parse:logic:with':function(){
        console.log(arguments)
      },

      'generate:block:if': function(e){
        var
          param = e.token.cap('param');
        if(param === 'if' || param === 'elseif') return '($.getData("'+'")' + + ')'
        e.contents = _.map(e.contents, function(content, index){
          
        },this)
      },

      // api tests
      'parse:syntax:mustache': function(){
        api.eventParseSyntaxMustache++;
      }
    },

    cache:false
  });
  var template = '{{if cond==1 with test}} {{foo}} {{elseif cond==2}} {{bar}} {{/if}}';
  mask.compile(template)
  var content = mask.abstract.content,
    contentExists = content[0] && typeof content[0][0] === 'object';

  deepEqual({
    eventParseSyntaxMustache: 5
  }, api)
  ok(contentExists && content[0][0].content.length === 2);
  ok(contentExists && content[0][0].token.length === 3);

  // mask.register(template);
});
//*/

//*
test('render()', function(){
  var mask = new Mask({
    syntax: [
      { skey: 'mustache',token:'{{ ? }}' },
      { skey: 'html', token: '<!-- ? -->|<!-- /%id -->', trimBlockBound : true }
    ],
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