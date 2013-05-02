/*! mask.js - v0.2.0 - 2013-05-02
 * https://github.com/sbekoe/maskjs
 * Copyright (c) 2013 Simon Bekoe; Licensed MIT */
(function (root, factory) {

  if (typeof exports === 'object') {
    var underscore = require('underscore');
    var backbone = require('backbone');
    module.exports = factory(underscore, backbone);
  } else if (typeof define === 'function' && define.amd) {
    define(['underscore', 'backbone'], factory);
  } else {
    root.Mask = factory(root._, root.Backbone);
  }

}(this, function (_, Backbone) {


  // global constants
var
  NAMESPACE_DELIMITER = '.',
  NAMESPACE_DELIMITER_EXP = /\./g,
  NAMESPACE_HOLD = ':',
  PATH_ATTR = RegExp('(?:^|\\' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')(\\w+)$'),
  PATH_OBJ = RegExp('(\\w+)(?:$|' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')'),

  root = this,
  prevMask = this.Mask;

// API strings
var
  LCAP = 'logic',
  LKEY = 'lkey', // logic key
  SKEY = 'skey'; // syntax key


  var Compiler = (function(){

  // Multi-pass compiler
  // The compiler builds the abstract layer (syntax tree) in three steps:
  // - generating a lexer from the syntax definitions
  // - scanning for all tokens in the template
  // - constructing the tree backwards (looking for block closers first and for matching openers then)
  var Compiler =  {
    compile: function(source, options){
      // enable use by prototype extension and standalone
      this.source = source || this.source || '';
      this.options = options || this.options || {};

      // define() is kind of a scanner generator lexer = scanner
      this.lexer = this.define();

      // lexical analyse: produces also tokens 'stream' which is used in the parser
      this.tokens = this.scan();

      // syntactic analyse: build abstract syntax tree
      this.abstract = this.parse();

      return this.abstract;
    },

    define: function(){
      var
        splitter = new Exp({
          source: "^#leftBound%logic#rightBound?$|^#leftBound?%logic#rightBound$",
          wildcards:{
            logic: '\\?|\\%id',
            leftBound:/.+/,
            rightBound:/.+/
          }
        }),

        leftBound_exp =  [],
        rightBound_exp =  [],
        lb = [],
        rb = [],
        logic_exp = [],

        lexer = {
          source: '#delimiterL#logic{1,,\\s+}#delimiterR',
          global: true,
          multiline: true,
          captureRepetition: true,
          wildcards: _.extend(
            this.options.wildcards,
            {
              delimiterL: leftBound_exp,
              delimiterR: rightBound_exp,
              logic: logic_exp
            }
          ),
          assignments: {
            s: this.options.syntax,
            l: this.options.logic
          }
        };

      // sort patterns and split there tokens into opener, divider & closer
      _.chain(this.options.syntax)
        .sort(function(s1,s2){ return (s2.priority||0) - (s1.priority||0) || s2.token.length - s1.token.length; })
        .each(function(s,index){
          s['behaviour'] = [];
          _.each(s.token.replace(/ /g, '%s').split('|'), function(p, i, list){
            var
              part = splitter.exec(p),
              part_lb = part.cap('leftBound'),
              part_rb = part.cap('rightBound'),
              l = !part_lb? false : s.trimBlockBound? '%ls' + part_lb: part_lb,
              r = !part_rb? false : s.trimBlockBound? part_rb + '%le' : part_rb,
              uniqueLBound = -1 === _.indexOf(lb, l),
              uniqueRBound = -1 === _.indexOf(rb, r);

            if(!part)
              console.error('Compiler: Invalid syntax definition in part %d of rule %s', i, s.skey);
            
            if(!uniqueLBound || !uniqueRBound)
              console.warn('Compiler: non-unique part %d in syntax definition %s %o', i, s.skey, s);

            s['behaviour'][i] = {
              part: i,
              skey: s.skey,
              type: i !== 0 && i === list.length - 1? 'closer' : 'opener',
              lb: l,
              rb: r
            };

            if(part_lb){
              lb.push(l);
              leftBound_exp.push('(' + Exp.esc(l, true) + ')>s.' + index + '.behaviour.' + i);  
            }

            if(part_rb){
              rb.push(r);
              rightBound_exp.push('(' + Exp.esc(r, true) + ')' + (uniqueLBound? '>' : '>>') + 's.' + index + '.behaviour.' + i);
            }
          });
        });

      // sort the markers/logic and build the selector regexp part
      _.chain(this.options.logic)
        .sort(function(l1,l2){ return (l2.priority||0) - (l1.priority||0) || l2.exp.length - l1.exp.length; })
        .each(function(l, i){
          logic_exp.push('(' + l.exp + ')>l.' + i);
        });

      return new Exp(lexer);
    },

    scan: function(source){
      var
        src = source || this.source,
        tokens = [],
        stream,
        text;

      // Lexical analysis (scanner)
      stream = this.lexer.scan(src, function(match, stream){
        if(text = src.slice(match.lastRange[1], match.range[0])){
          stream.push('text ' + (tokens.push(text)-1));
        }
        // return match.type + ' ' + (tokens.push(match) - 1) + (' ' + (match.skey || '')) + (' ' + (match.param.join(' ') || ''));
        return match.atm('type') + ' ' + (tokens.push(match) - 1) + (' ' + (match.atm('skey') || '')) + (' ' + (match.cap(['param']).join(' ') || ''));
       // return (match['opener']? 'opener ' : 'closer ') + (tokens.push(match)-1) + (' ' + (match.pattern || '')) + (' ' + (match.param.join(' ') || ''));
      });

      if(this.lexer.lastMatch) stream.push('text ' + (tokens.push(src.slice(this.lexer.lastMatch.range[1]))-1));

      this.stream = stream.reverse().join('\n');

      return tokens;
    },

    parse: function(s,a){
      var
        that = this,
        abstract = a || {namespace: this.namespace || 'root', content:[[]], token:[]},
        stream = s || this.stream,
        child,
        nextToken = /^(text|closer|opener) (\d+)(?: (\w+))?(?: (\w+))?.*$/gm,
        nextIndexedOpener,
        nextOpener,
        hash, // hash of a token
        ohash, // hash of an opener token
        nested,
        behaviour = {},
        token;

      while(hash = nextToken.exec(stream)){
        token = this.tokens[hash[2]];
        // if(this.trigger){
        if(this.trigger && hash[1] !== 'text'){
          this.trigger('parse:syntax:' + token.atm('skey'),
            token,
            child = {
              namespace:'',
              content:[],
              token: []
            },
            behaviour = {
              complete:true,
              valid:true,
              namespace: token.cap('namespace') || token.cap('param') || ''
              // namespace: token.cap('namespace')? token.cap('namespace')[0] : token.cap('param')? token.cap('param')[0] : ''
            }
          );

          // if(token.cap('logic')) _.each(token.cap(['logic']), function(l){
          if(token.cap('logic')) token.cap('logic').each( function(l){
            this.trigger('parse:logic:' + l.atm('lkey'), token, child, behaviour, l);
          }, this);
        }

        if(!behaviour.valid && hash[1] !== 'text')
          continue;

        

        behaviour = {};

        switch(hash[1]){
          case 'text':
            child = this.tokens[hash[2]];
            break;
          case 'closer':
            child.token.splice(0, 0, token);
            //TODO: nextToken.mode('indexedOpener opener').update({wildcards:{type:hash[3], param:hash[4]})
            nextIndexedOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ') .*('+ hash[4] + ').*$','gm'); // insert pattern and id/closer id
            nextOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ').*$','gm'); // insert pattern
            nextIndexedOpener.lastIndex = nextOpener.lastIndex = nextToken.lastIndex;
            /*
            ohash = nextIndexedOpener.exec(stream) ||
              nextOpener.exec(stream) ||
              error(this.debug, '(Compiler) No opener found for the token: ' + hash[0]);
            //*/

            while(!behaviour.complete && (ohash = nextIndexedOpener.exec(stream) || nextOpener.exec(stream))){
              token = this.tokens[ohash[2]];

              if(this.trigger){
                this.trigger('parse:syntax:' + token.atm('skey'), token, child, behaviour = {
                  complete:true,
                  valid:true,
                  namespace: token.cap('namespace') || token.cap('param') || ''
                  // namespace: token.namespace? token.namespace[0] : token.param? token.param[0] : ''
                });

                token.cap('logic').each(function(l){
                // _.each(token.cap('logic'), function(l){
                  this.trigger('parse:logic:' + l.atm('lkey'), token, child, behaviour, l);
                }, this);
              }

              nextIndexedOpener.lastIndex = nextOpener.lastIndex = ohash.index + ohash[0].length;

              if(!behaviour.valid) continue;
              child.token.splice(0, 0, token);

              nested = stream.slice(nextToken.lastIndex, ohash.index);
              child.namespace = abstract.namespace + NAMESPACE_DELIMITER + behaviour.namespace;
              nextToken.lastIndex = ohash.index + ohash[0].length;

              if(nested !== ''){
                child.content.splice(0, 0, []);
                this.parse(nested, child);
              }
            }


            break;
          case 'opener':
            child.token.splice(0, 0, token);
            break;
        }

        abstract.content[0].push(child);

      }

      _.invoke(abstract.content,'reverse');

      return abstract;
    }


  };
  return Compiler;
})();

  var Generator = (function(){
  var Generator = {

    // produces a js string from a js template and and an abstract holding additional info
    generate: function(template, asbstract){
      var
        tpl = this._template[template || this.option.template] || console.error('Generator: The template' + template + 'do not exist.'),
        tokens = tpl.tokens.slice(0),
        trl = this._translator,
        key, key2, result;

      asbstract = asbstract || this.asbtract || {};

      
      for(var i in tpl.key)
        tokens[i] = this.translate(asbstract, tpl.key[i]);

      return tokens.join('');
    },


    // call a translator,
    // directly use an abstract attribute
    // or reinsert the key
    translate: function(abstract, key){
      var
        _key = key.toLowerCase(),
        trl = this._translator[key] || this._translator[_key];

      return (trl && trl.call(this, abstract, key)) ||
        abstract[key] ||
        abstract[_key] ||
        key;
    },

    // Hold an api for adding new templates
    addTemplate: function(template, key){
      var match, keys, tpl = {tokens:[], key:{}}, prevIndex = 0, offset;
      this._template || (this._template = {});

      if(!!this._template[key])
        console.warn('Generator: Overwrite template "%s"', key);

      switch(typeof template){
        case 'function':
          template = template.toString();
        case 'string':
          match = this._keyList.exec(template) || {};
          keys = match[1]? match[1].split(/\s*,\s*/) : [];
          keys.push('_([A-Z]+)_');
          keys = new RegExp(keys.join('|') ,'g');

          template = template.slice(
            this._keyList.lastIndex || template.indexOf('{') + 1,
            template.lastIndexOf('}')
          );

          if((offset = this._offset.exec(template)[0]).length)
            template = template.replace(new RegExp('(^|\\n)' + Generator.esc(offset, true),'g'),'$1');
          template = template.replace(/\s*$/,'');
          while(match = keys.exec(template)){
            tpl.tokens.push(
              template.slice(prevIndex, match.index),
              undefined
            );
            tpl.key[tpl.tokens.length - 1] = match[1] || match[0];
            prevIndex = keys.lastIndex;
          }
          tpl.tokens.push(template.slice(prevIndex));

          this._template[key] = tpl;
          this._keyList.lastIndex = 0;
          break;

        case 'object':
          this._template[key] = template;
          break;
      }

      return this;
    },

    // Hold an api for adding new translator functions
    addTranslator: function(fct, key){
      if(!!this._translator[key])
        console.warn('Generator: Overwrite translator "%s"', key);
      this._translator[key] = fct;

      return this;
    },

    _template: {},
    _translator: {},
    _offset: /^[\s\t]*/,
    _keyList: /\s*\/\*\*\s*@marker\s*\*\/\s*var\s*([^;]+)\s*;\n*/g,


    // Utils
    esc: function(str){
      return str
        .replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\\"')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
    },

    stringify: function(str){
      return '"' + this.esc(str) + '"';
    }
  };

  return Generator;
})();

  var View = (function(){
  // The view layer
  // The output classes will inherit from this class as default
  var View = function(options){
    this.data = {};
    this.meta = {};
    this.parent = {};
    this.nested = [];
    this.index = 0;

    // to enable data traversing (accessing parents data by there getData fct)
    // getData should always be bound to its owner
    this.getData = _.bind(this.getData, this);

    this._configure(options || {});
    this.initialize.apply(this, arguments);

    // register this instance in its parent if one exist
    if(this.parent.nested !== undefined) this.index = this.parent.nested.push(this) - 1;

  };

  var viewOptions = ['data', 'meta', 'parent'];

  View.prototype = {
    initialize: function(){},

    nest: function(data, viewPath){
      var
        view = Mask.v[viewPath],
        // metadata scope provides runtime data
        meta = {i:0, n:0};

      if(view === undefined) return '';

      return _.chain(makeArray(data))
        .map(function(data, i, l){
          meta.i = i;
          meta.n = l.length;
          return view.create({
            data: data,
            meta: meta,
            parent:this
          })
            .render();
        },this)
        .tap(function(){ delete meta.i, meta.n; })
        .join('')
        .value();

    },

    render: function(){
      return '';
    },

    handle: function(dataPath, viewPath){
      var data = this.getData(dataPath);
      switch(typeof data){
        case 'string':
        case 'number': return data;
        case 'boolean': return data? PATH_ATTR.exec(dataPath)[1] : '';
        case 'object': return this.nest(data, viewPath);
        default: return '';
      }
    },

    getData: function(path){
      return  lookup(path, this.data, this.parent.getData, this.meta);
    },

    addData: function(){
      var that = this;
      _.each(arguments, function(data){
        this.getData = function(path){
          return lookup(path, data, that.getData, that.meta);
        };
      }, this);
      return this;
    },

    _configure: function(options) {
      if (this.options) options = _.extend({}, this.options, options);
      for (var i = 0, l = viewOptions.length; i < l; i++) {
        var attr = viewOptions[i];
        if (options[attr]) this[attr] = options[attr];
      }
      this.options = options;
    }
  };

  View.create = function(options){ return new this(options); };
  
  return View;
})();

  var Mask = (function(){
  
  var Mask  = function (options) {
    this.init(options);
  };

  _.extend(Mask.prototype, Compiler, Generator, Backbone.Events,{
    init: function(options){
      options = _.isObject(options)? options : presets[options] || presets['default'];

      this.options = {};

      this.configure(defaults, presets[options.preset] || {}, options);

      _.each(this.options.templates, this.addTemplate, this);
      _.each(this.options.translator, this.addTranslator, this);
     // _(this.options.events).each(this.on,this);
      this.on(this.options.events || this.options.on || {});
    },

    configure: function(){
      options.apply(this, _(arguments).splice(0, 0, this.options));
    },

    register: function(source, template){
      var code = this.generate(
        template || this.options.template,
        typeof source === 'string'? this.compile(source) : source
      );

      // in the browser
      appendScript(code);

      // on the server ...
    },

    create: function(namespace, options){
      return Mask.create(namespace, options);
    },

    _translator: {
      content: function(abstract, key){
        var
          that = this,
          blockEvent,
          contentEvent,
          lkey,
          length = abstract.content.length;

        if(!abstract.content[0]) return key;

        blockEvent = {
          contents: _.map(abstract.content, function(content, index){
            var token = abstract.token[index];

            contentEvent = {
              content:
                _.map(content, function(token,j){
                  return typeof token === 'string'? Generator.stringify(token) : that.translate(token, 'token'); //that._translator.token.call(that, token, key);
                }).join(' + '),
              token: token,
              abstract: abstract,
              index: index,

              first: index === 0,
              last: index === length - 1
            };

            // trigger default content event
            that.trigger('generate:content', contentEvent);

            // trigger event for each logic of this token
            token && token.cap(LCAP).each(function(submatch){
              that.trigger('generate:logic:' + submatch.atm(LKEY), contentEvent);
            });

            return  contentEvent.content;
          
          },this),
          abstract: abstract
        };

        that.trigger('generate:block', blockEvent);

        // return blockEvent.contents.join('');
        return chain(blockEvent.contents)
          .flatten()
          .join('')
          .value();
      },

      token: function(abstract, key){
        var
          nested = abstract.viewPath || (abstract.content && abstract.namespace && abstract.content.length),
          dataPath = abstract.dataPath || abstract.token[0].cap('namespace'),
          viewPath = abstract.viewPath || (nested && abstract.namespace);

        if(nested)
          this.register(abstract);

        return "$.handle('" + dataPath + "'" + (viewPath? ", '" + viewPath + "'" : "") + ')';
      }
    },
    debug: true
  });

  _.extend(Mask, {
    create: function(namespace, options){
      if(!_.isFunction(this.v[namespace]))
        console.error('The view class  >>' + namespace + '<< doesn\'t exist');

      return new this.v[namespace](options);
    },

    noconflict: function(){ root.Mask = prevMask; return this; },

    v: {}
  });

  
  var presets = Mask.presets = {
      "default":{}
    },

    defaults = Mask.defaults = {
      data:{},
      syntax:[
       { skey: 'mustache', token:'{{ ? }}'}
      ],
      wildcards: {
        "id":"(#param:%ns)", // id for closing marker
        "ns":"%w(?:\\.%w)*", // the namespace to be resolved while getting data
        "ls":"(?:^[ \\t]*)?", // line start
        "le":"\\n?", // line end
        "n":"\\n", // line break
        "s":"[ \\t]*", // white space (no line breaks)
        "w":"\\w+", // word
        "namespace":"%ns", // namespace
        "path": "\\w+(?:\\.(?:\\w+|\\[\\d+\\]))*"
      },
      //logic
      multipleLogic:true,
      logic:[
        { lkey:'path', exp:'(#param:#namespace)' }
      ],
      template: 'View',
      templates:{
        View: function() {
          /** @marker */ var NAMESPACE, CONTENT;

          Mask.v['NAMESPACE'] = Mask.View.extend({
            render:function (data) {
              var $ = this;
              if(data) $.data = data;

              return CONTENT;
            },
            initialize: function () {}
          });
        }
      },
      translator:{},
      preset:'html', // TODO: change this to 'default' when this preset is created
      cache:true
    };

  return Mask;
})();

  var Console = (function(console){
    if(Console)
      return Console;

    var
      Console = function(options){
        var o = options || {};
        this.quiet = !!o.quiet;
      },
      node = !window,
      phantom = navigator && /phantom/i.test(navigator.userAgent),
      msg_prefix = {
        warn: 'Warning: ',
        log: '',
        error: 'Error: '
      },
      method,
      placeholder = /%([sdo])/g;
    Console.quiet = false;
    Console.format = function(a){
      var
        args = [].slice.call(a),
        stringFirst = typeof args[0] === 'string';
      
      if(node && stringFirst)
        args[0] = args[0].replace(/%o/g,'%j');
      
      if((!console || phantom) && stringFirst && args.length > 1)
        args[0] = args[0].replace(placeholder, function(m,p){
          if(!args[1]) return m;
          var a = args.splice(1,1)[0];
          switch(p){
            case 's': return '' + a;
            case 'd': return parseInt(a);
            case 'f': return parseFloat(a);
            default: return JSON && JSON.stringify(a) || '' + a;
          }
        });
      return args;
    };

    Console.prototype.put = function(msg){
      window.setTimeout(function(){ throw msg; }, 1);
      c.log('test');
    };

    for(method in msg_prefix)(function(method, prefix){
      Console[method] = Console.prototype[method] = function(){
        var args = Console.format(arguments);          
        return !this.quiet && (console && console[method] && !console[method].apply(console, args) || this.put(prefix + args.join()));
      };
    })(method, msg_prefix[method].toUpperCase());

    return Console;
  })((window || global).console);

  // Helpers
var 
  options = function(obj) {
    _.each(_(arguments).slice(1), function(source) {
      if (source) {
        for (var prop in source) {
          if(_.isArray(source[prop]) && _.isArray(obj[prop])) {
            obj[prop] = source[prop].concat(obj[prop]);
          } else if(_.isObject(source[prop]) && _.isObject(obj[prop])) {
            obj[prop] = options({}, obj[prop], source[prop]);
          } else {
            obj[prop] = source[prop];
          }
        }
      }
    });
    return obj;
  },

  isArray =  Array.isArray || function(a) { return Object.prototype.toString.call(a) === '[object Array]'; },

  makeArray = function(a) { return isArray(a)? a : [a]; },

  resolve = Mask.resolve =  function(namespace, obj, delimitter){
    delimitter = delimitter || NAMESPACE_DELIMITER_EXP;
    obj = obj || window;
    namespace = namespace.split(delimitter);
    try{ return eval('(obj["' + namespace.join('"]["') + '"])'); }
    catch(e){ return undefined; }
  },

  lookup = function(namespace, data, lookup, meta){
    var r,
      up = namespace[0] === NAMESPACE_DELIMITER,
      hold = namespace[0] === NAMESPACE_HOLD,
      n = namespace.slice(up || hold), // make use of native type cast (boolean to number) to strip the prefixes from the namespace
      m = meta || {};
    return n === '' ? data :                                // current context
      (r = data[n] || m[n]) !== undefined? r :         // attr of current or meta context context
        (r = resolve(n, data)) !== undefined? r :       // path in current context
          lookup && !hold? lookup(n) : undefined;     // recursive lookup
  },

// backbones extend function for inheritance
  extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ parent.apply(this, arguments); };
    }

    _.extend(child, parent, staticProps);

    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate();

    if (protoProps) _.extend(child.prototype, protoProps);

    child.__super__ = parent.prototype;

    return child;
  },

  jsSource = /\.js/i,

  appendScript = function(src){
    // in the browser
    // http://stackoverflow.com/questions/610995/jquery-cant-append-script-element
    var head = document.getElementsByTagName('head'),
      script = document.createElement('script');

    script.type  = "text/javascript";
    if (jsSource.test(script)) script.src = src;
    else script.text = src;

    document.body.appendChild(script);
    document.body.removeChild(document.body.lastChild);

    // on the server
    // TODO: put script to file here
  },
  output = function(type, values){
    var args = _.rest(arguments);
    _.defer(function(){ throw type.toUpperCase() + values; });
    console.log('test');
    console.warn('foo %s', 'bar');
  };

  var console = new Console({quiet:false});



  // underscore helpers
  var 
    chain = _.chain;

  var console = new Console({quiet:false});

  View.extend = extend;

  Mask.View = View;

  Mask.Generator = Generator;

  Mask.VERSION = '0.2.0';

  return Mask;
}));
