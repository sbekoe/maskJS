//  maskjs 0.1

//  (c) 2012 Simon Bekoe
//  maskJS may be freely distributed under the MIT license.
//  https://github.com/sbekoe/maskJS
//  dependencies: underscorejs


(function(window, document, undefined){

  var
    NAMESPACE_DELIMITER = '.',
    NAMESPACE_DELIMITER_EXP = /\./g,
    NAMESPACE_HOLD = ':',
    PATH_ATTR = RegExp('(?:^|\\' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')(\\w+)$'),
    PATH_OBJ = RegExp('(\\w+)(?:$|' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')'),

    root = this,
    prevMask = this.Mask;



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
        pattern = this.options.pattern,
        marker = this.options.marker,
        nested = new RegExp('^(.+)' +  '%logic' + '(?:(.*)' + '%tmp' + ')(.+(%id).*|.+)$'),
        parts = new Exp({
          source: "^#delimiterL\\%logic(?:#delimiterR#nested)#closer|#delimiterL\\%logic#delimiterR?$",
          wildcards:{
            closer:{source:".+#id.*|.+"},
            id:/\%id/,
            nested:'\%tmp',
            delimiterL:/.+/,
            delimiterR:/.+/
          }
        }),
        markerOrder = [],
        patternOrder = [],
        exp = /#opener|#closer/gm,
        wildcards = _.extend(
          {"id":"(#param:%ns)","ns":"%w(?:\\.%w)*","ls":"(?:^[ \\t]*)?","le":"(?:[ \\t]*\\n)?","n":"\\n","s":"[ \\t]*","w":"\\w+", "namespace":"%ns"},
          {opener:'#delimiterL#logic#delimiterR', closer:[], delimiterL:[], delimiterR:[], logic:[]}
        ),
        part,id, closer,  i, p, m, t;

      // sort patterns
      for(m in pattern){if(pattern.hasOwnProperty(m)){ patternOrder.push(m); pattern[m].name = m;}}
      patternOrder.sort(function(m1,m2){
        return (pattern[m2].priority||0) - (pattern[m1].priority||0) || pattern[m2].token.length - pattern[m1].token.length;
      });

      // split token into opener, divider & closer
      for(i=0; i<patternOrder.length; i++){
        p = pattern[patternOrder[i]];
        if (p.token && (part = parts.exec(p.token))) {
          if (part['delimiterL'][0]) {
            wildcards.delimiterL.push('(' + Exp.esc(part.delimiterL[0],true) + ')>' + patternOrder[i])
          }
          if (part['delimiterR'][0]) {
            wildcards.delimiterR.push(Exp.esc(part['delimiterR'][0],true));
          }
          if (part['closer'][0] || part['delimiterR'][0]) {
            wildcards.closer.push('(' + Exp.esc(part['closer'][0]? part['closer'][0].replace('%id','#id') : part['delimiterR'][0], true) + (part['closer_id'][0] ? ('|' + Exp.esc(part['delimiterR'][0],true)) : '') + ')>' + patternOrder[i])
          }
        }
      }

      for(m in marker){if(marker.hasOwnProperty(m)){ markerOrder.push(m); marker[m].marker = m;}}
      markerOrder.sort(function(l1,l2){
        return marker[l2].priority - marker[l1].priority || marker[l2].exp.length - marker[l1].exp.length;
      });

      // build the selector regexp part
      for(i=0; i<markerOrder.length; i++){
        wildcards.logic.push('('+marker[markerOrder[i]].exp+')>'+markerOrder[i]);
      }

      return new Exp(exp,{
        wildcards:wildcards,
        assignments:_.extend({},pattern,marker)
      });
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
        return (match['opener'][0]? 'opener ' : 'closer ') + (tokens.push(match)-1) + (' ' + (match.name || '')) + (' ' + (match.param.join(' ') || ''));
      });
      if(this.lexer.lastMatch) stream.push('text ' + (tokens.push(src.slice(this.lexer.lastMatch.range[1]))-1));

      this.stream = stream.reverse().join('\n');

      return tokens;
    },

    parse: function(s,a){
      var
        abstract = a || {namespace: this.namespace || 'root', content:[[]], token:[[]]},
        stream = s || this.stream,
        child,
        nextToken = /^(text|closer|opener) (\d+)(?: (\w+))?(?: (\w+))?.*$/gm,
        nextIndexedOpener,
        nextOpener,
        hash, // hash of a token
        ohash, // hash of an opener token
        nested;

      while(hash = nextToken.exec(stream)){
        child = {namespace:'', content:[], token: [this.tokens[hash[2]]]};

        switch(hash[1]){
          case 'text':
            child = this.tokens[hash[2]];
            break;
          case 'closer':
            //TODO: nextToken.mode('indexedOpener opener').update({wildcards:{type:hash[3], param:hash[4]})
            nextIndexedOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ') .*('+ hash[4] + ').*$','gm'); // insert pattern and id/closer id
            nextOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ').*$','gm'); // insert pattern
            nextIndexedOpener.lastIndex = nextOpener.lastIndex = nextToken.lastIndex;

            ohash = nextIndexedOpener.exec(stream) ||
              nextOpener.exec(stream) ||
              error(this.debug, '(Compiler) No opener found for the token: ' + hash[0]);

            child.token.splice(0, 0, this.tokens[ohash[2]]);

            nested = stream.slice(nextToken.lastIndex, ohash.index);
            child.namespace = abstract.namespace + NAMESPACE_DELIMITER + (this.tokens[ohash[2]]['namespace'][0]||'');
            nextToken.lastIndex = ohash.index + ohash[0].length;

            if(nested !== ''){
              child.content.splice(0, 0, []);
              this.parse(nested, child);
            }

            break;
          case 'opener':

            break;
        }

        abstract.content[0].push(child);

      }

      _.invoke(abstract.content,'reverse');

      return abstract;
    }

  };


  // The Generator
  // A small template engine on its own.
  // It provides code generation from js templates (given in a wrapper function or in string format) and an abstract object.
  // Key words in the template are replaced with the result of a translator function or a related attribute in the abstract.
  var Generator = {

    // produces a js string from a js template and and an abstract holding additional info
    generate: function(template, asbstract){
      var tpl = this._template[template || this.option.template] || error(this.debug, '(generator) The template' + template + 'do not exist.'),
        tokens = tpl.tokens.slice(0),
        trl = this._translator,
        key, key2, result;
      asbstract = asbstract || this.asbtract || {};

      // for each key in the template, check case sensitive and with lower case:
      // - call a translator,
      // - directly use an abstract attribute
      // - or reinsert the key
      for(var i in tpl.key){
        key = tpl.key[i];
        key2 = key.toLowerCase();
        tokens[i] = trl[key] && (result = trl[key].call(this, asbstract, key)) !== undefined? result :
          trl[key2] && (result = trl[key2].call(this, asbstract, key)) !== undefined? result :
            asbstract[key] || asbstract[key2] || key;
      }

      return tokens.join('');
    },

    // Hold an api for adding new templates
    addTemplate: function(template, key){
      var match, keys, tpl = {tokens:[], key:{}}, prevIndex = 0, offset;
      this._template || (this._template = {});

      log(!!this._template[key], '(generator) Overwrite template "' + key + '"');

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
      log(!!this._translator[key], '(generator) Overwrite translator "' + key + '"');
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





  // The view layer
  // The output classes will inherit from this class as default
  var View = function(options){
    this.data = {};
    this.meta = {}
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

    handle: function(path, viewPath){
      var data = this.getData(path)
      switch(typeof data){
        case 'string':
        case 'number': return data;
        case 'boolean': return data? PATH_ATTR.exec(path)[1] : '';
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


  }

  View.create = function(options){ return new this(options)};

  var Mask  = function (options) {
    this.init(options);
  }

  _.extend(Mask.prototype, Compiler, Generator, {
    init: function(options){
      options = _.isObject(options)? options : presets[options] || presets['default'];

      this.options = {};

      this.configure(defaults, presets[options.preset] || {}, options);

      _.each(this.options.templates, this.addTemplate, this);
      _.each(this.options.translator, this.addTranslator, this);
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
        var content = abstract.content[0],
          marker = this.options.marker;
        if(!content) return key;

        return _.map(content, function(el){
          if(typeof el === 'string') return Generator.stringify(el);
          return  marker[el.token[0].marker].translator? marker[el.token[0].marker].translator.call(this, el, key) : this._translator.token.call(this, el, key);

        }, this).join(' + ');
      },

      token: function(abstract, key){
        var nested = !!abstract.content.length;

        if(nested) this.register(abstract);

        return "$.handle('" +
          abstract.token[0].namespace + "'" +
          (nested? ", '" + abstract.namespace + "'" : "") +
          ')';
      },

      debug: true

    }
  });

  _.extend(Mask, {
    View: View,
    Generator: Generator,

    create: function(namespace, options){
      error(!_.isFunction(this.v[namespace]), 'The view class  >>' + namespace + '<< doesn\'t exist');

      return new this.v[namespace](options);
    },

    noconflict: function(){ root.Mask = prevMask; return this; },

    v: {}
  });

  // Utils
  var presets = Mask.presets = {
      default:{}
    },
    defaults = Mask.defaults = {
      data:{},
      pattern:{
        mustache:{ token:'{{%logic}}' }
      },
      wildcards: {
        "id":"(#param:%ns)", // id for closing marker
        "ns":"%w(?:\\.%w)*", // the namespace to be resolved while getting data
        "ls":"(?:^[ \\t]*)?", // line start
        "le":"(?:[ \\t]*\\n)?", // line end
        "n":"\\n", // line break
        "s":"[ \\t]*", // white space (no line breaks)
        "w":"\\w+", // word
        "namespace":"%ns" // namespace
      },
      marker:{
        "default": {
          exp:'(#param:#namespace)'
//                    translator: function(abstract, key){
//                        return "$.handle('" + abstract.token[0]['$namespace'] + "')";
//                    }
          //priority:0
        },

        "condition":{
          exp: "(#param:%ns)(?:(#param:==|!=|<|>|<=|>=)(#param:%ns))?\\?(#param:#namespace)(?:\\:(#param:%ns))?"
        }
      },
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
    },

  // Utilities
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
        meta = meta || {};
      return n === '' ? data :                                // current context
        (r = data[n] || meta[n]) !== undefined? r :         // attr of current or meta context context
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
      child.prototype = new Surrogate;

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

    error = function(cond, msg){
      if(cond === true) throw new Error('maskjs error: ' + msg);
    },

    log = function(cond, msg){
      cond === true && console && console.log && console.log('maskjs log: ' + msg);
    };

  View.extend = extend;

  if(typeof module !== 'undefined') module.exports = Mask;
  else root.Mask = Mask;

  //return Mask;
}(window, document));
