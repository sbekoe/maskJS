/*! exp.js - v0.2.1 - 2013-05-05
 * https://github.com/sbekoe/exp.js
 * Copyright (c) 2013 Simon Bekoe; Licensed MIT */
(function (root, factory) {

  if (typeof exports === 'object') {
    var underscore = require('underscore');
    module.exports = factory(underscore);
  } else if (typeof define === 'function' && define.amd) {
    define(['underscore'], factory);
  } else {
    var _ = root._;
    root.Exp = factory(_);
  }

}(this, function (_) {
'use strict';

//global helpers     
var 
  escNativeExp = new RegExp('[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|]','g'),
  escAdvancedExp = new RegExp('[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|%#]','g'),
  esc = function(string, nativeCharsOnly){
    if(_.isArray(string)) string = string.join('');
    return string.replace(nativeCharsOnly? escNativeExp : escAdvancedExp, "\\$&");
  },
  resolvePath = function(path, obj, delimitter){
    delimitter = delimitter || '.';
    obj = obj || window;
    if(obj[path]) return obj[path];
    path = (path + '').split(delimitter);
    try{ return eval('(obj["' + path.join('"]["') + '"])'); }
    catch(e){ return undefined; }
  };

var
  INJECTION_PREFIX = '%',
  CAPTURE_PREFIX = '#',
  ASSIGNMENT_PREFIX = '>',

  PATH_DELIMITER = '.',
  DELIMITER_ESC = esc(PATH_DELIMITER, true),
  PATH = "\\w+(?:"+ DELIMITER_ESC +"(?:\\w+|\\[\\d+\\]))*",
  DEEP_PATH = "\\w+(?:"+ DELIMITER_ESC +"(?:\\w+|\\[\\d+\\]))+",
  ASSIGNMENT_EXP = new RegExp('(^'+ASSIGNMENT_PREFIX + '{1,2})(' + PATH + ')'),
  REPETITION_EXP = /^[*+]|^\{(\d+)(,?)(\d*)(?:,([^\}]+))?\}/,
  MARKER = new RegExp('\\$(' + PATH + '|[\\d&])', 'g'),
  DEBUG_MODE = true,
  SPLITTER = /,|\s+/,
  PARENTHESIS = /(\\\(|\(\?[:=!])|\((?:#\w+:)?/g,

  BREAK = {},
  SKIP = {};

// collection class

var Collection = (function(_){
  //'use strict';

  var Collection = function(list){
    this._wrapped = list || [];
  };

  Collection.prototype = _([]);

  Collection.prototype.bind = function(method, context) {
    var obj = this._parent, _this = this;
    if(_.isFunction(obj[method]))
      _this[method] = function(){
        var args = arguments;
        return this.map(function(e){
          return obj[method].apply(context || e, args);
        });
      };
    else if(_.isFunction(_[method]))
      _this[method] = function(){
        var args = arguments;
        return this.map(function(e){
          return _[method].apply(context || e, [e].concat(args));
        });
      };
    else
      _this[method] = function(){
        var args = arguments;
        return this.map(function(e){
          return _.isFunction(e[method])? e[method].apply(context || e, args) : e[method];
        });
      };
    return _this[method];
  };

  Collection.prototype.add = function(e) {
      this.push(_.isFunction(this._parent)? this._parent.apply(null, arguments) : e);
  };

  Collection.extend = function(protos, statics){
    var
      s = statics || {},
      fn = s.fn || {},
      context = s.context,
      parent = protos.prototype || protos,
      bind = statics.bind || _.functions(protos),
      c = s.constructor || function(){},
      constructor = function(){
        Collection.apply(this, arguments);
        c.apply(this, arguments);
      },
      proto = _.extend(new Collection(), fn);
      _.extend(constructor, s);

    proto._parent = parent;
    
    _.each(bind, function(fct){
      proto.bind(fct, context);
    });

    constructor.prototype = proto;

    return constructor;
  };

  return Collection;
})(_);

// exp class
var Exp = (function(){
  var Exp = function (exp, options){
    if (exp instanceof Exp){ return exp; }
    if (!(this instanceof Exp)){ return new Exp(exp, options); }
    this.initialize(exp, options);
  };

  Exp.prototype = {
    initialize: function(exp, options){
      var settings = options || exp || {};

      // initial properties
      this.source = exp.source? exp.source.toString() : exp;
      this.global = exp.global || settings.global;
      this.ignoreCase = exp.ignoreCase || settings.ignoreCase;
      this.multiline = exp.multiline || settings.multiline;

      this.options = _.extend({}, defaults, options, exp);
      _.extend(this, _.pick(this.options, specialOpt));
      this.flags = settings.flags || '';
      this.wildcards = settings.wildcards || {};

      this.assignments = settings.assignments || {};

      // runtime properties
      this.zero(settings.lastIndex);

      this.compile(settings);
    },

    zero: function(lastIndex){
      this.lastIndex = lastIndex || 0;
      this.lastRange = [0, lastIndex || 0];
      this.lastMatch = null;
      return this;
    },

    /** @constructs */
    compile:function(options){
      var
        names = [],
        injections = [],
        captures = [],
        escaped = ['\\(', '\\)', CAPTURE_PREFIX, INJECTION_PREFIX],
        wc = this.wildcards,
        settings = options||{},
        w;

      for(w in wc){if(wc.hasOwnProperty(w)){
        if(w[0] === CAPTURE_PREFIX){w = w.slice(1); captures.push(w); escaped.push(w);}
        if(w[0] === INJECTION_PREFIX){ w = w.slice(1); injections.push(w); escaped.push(w);}
        names.push(w);
      }}
      this._captures = settings.captures || [{path:'', name:''}];
      this.indices = settings.indices || {path:{}, name:{}, list:{}};
      this.offset = settings.offset || 0;
      this._escaped = escaped;
      this._needle = new RegExp(
        '\\\\(' + escaped.join('|') + ')|' +
        '\\((' + CAPTURE_PREFIX + '|' + INJECTION_PREFIX + ')(\\w+(?:,\\w+)*):|' + // opener of named inline capture/injection
        '(\\((?!\\?:))|' + // opening parenthesis for native capture resp. unnamed capture. but prevent from matching non-capturing parentheses: '(' but not '(?:'
        '(' + CAPTURE_PREFIX + '|' + INJECTION_PREFIX + ')(' + (names.sort(byLength).join('|')||'$^') + ')|' + // captures/injections named in wildcards
        '(' + (captures.join('|')||'$^') + ')|' + // predefined captures named in wildcards
        '(' + (injections.join('|')||'$^') + ')', // predefined injections named in wildcards
        'g'
      );

      var
        src = this._captures.length>1?this.source : this.build(this.source, this._captures),
        flags = this.flags || ((this.global? 'g' : '') + (this.ignoreCase? 'i' : '') + (this.multiline? 'm' : ''));

      this._exp = new RegExp(src, flags);
    },

    // Build the expression string with replaced wildcards
    build: function(source, captures, namespace){
      var
        srcArr = _.isArray(source)? source : [source],
        wc = this.wildcards,
        needle = this._needle, // regexp to detect the (escaped) special characters.
        escaped = this._escaped,
        iName = this.indices.name,
        iPath = this.indices.path,
        iList = this.indices.list,

        // The namespace is a stack containing the keywords of the nested captures and injections
        // The name space is used to build the attribute name of a capture in a match. e.g: match.$keyword_nestedKeyword
        ns = namespace || [],

        exp = '',
        lastIndex = needle.lastIndex = 0,
        keywords,
        isCapture,
        capture,
        match,
        // the expression that replaces the keyword
        replacement,
        sub,
        i, src, r, a, n, e;

      for(i=0; i<srcArr.length; i++){
        src = srcArr[i].hasOwnProperty('s')? srcArr[i].s : srcArr[i].hasOwnProperty('srcArr')? srcArr[i].source : srcArr[i];
        if(!src){return '';}

        // disjunction of source elements
        if(i>0) exp += '|';

        while(match = needle.exec(src)) {
          // do nothing if an escaped characters was detected, but on captures and injections
          if (replacement = wc[match[6]] || wc[CAPTURE_PREFIX + match[7]] || wc[INJECTION_PREFIX + match[8]]  || (match[2]||match[4]? {s:findClosedReplacement(src.slice(needle.lastIndex)), a:srcArr[i].a||srcArr[i].assign} : false)) {
            // check if the the keyword is a capture
            isCapture = match[2] === CAPTURE_PREFIX || match[4] || match[5] === CAPTURE_PREFIX || typeof match[7] !== 'undefined';
            keywords = (match[3] || match[6] || match[7] || match[8] || '').split(',');

            // check for infinity recursion and add the current keyword to the namespace
            if(ns.indexOf(keywords[0]) === -1) ns.push(keywords[0]);
            else this.error('"'+ keywords[0] + '" includes itself. This would end up in infinity recursion loop!');

            // store the keyword in the captures array if necessary
            if(isCapture){
              n = captures.push(capture = {name: keywords[0], path: ns.join(PATH_DELIMITER), aliases: _.rest(keywords)});
              e = exp.length;
              // indicate capture name, aliases and path
              _.each(keywords, function(k){
                (iName[k] || (iName[k] = [])).push(n-1);
              });Object
              (iPath[capture.path] || (iPath[capture.path] = [])).push(n - 1);
            }

            // add the prepended native expression string and the replacement to the compiled expression
            // the replacement expression is build recursive and wrapped with ( ) for capturing or (?: ) for injection
            sub = this.build(replacement.s || replacement.source || replacement, captures, ns);
            exp += src.slice(lastIndex, match.index);

            lastIndex = match.index + match[0].length + (match[2]||match[4]? replacement.s.length + 1 : 0);
            
            // check for assignments
            if(isCapture && (a = src.slice(lastIndex).match(ASSIGNMENT_EXP))){
              lastIndex += a[0].length;
              capture.a = {
                force: 2 === a[1].length,
                path: a[2]
              };
            }

            // check for repetitions
            //
            // separated repetitions
            // e.g a list of numbers (<\d>'s) separated by a whitespace
            // - exactly 5:   /(\d){5, }/     -->   /(\d(?: \d){4})/      matches '0 1 2 3 4'
            // - indefinite:  /(\d){0,, }/    -->   /(\d?(?: \d){0,})/    matches '0 1 2 3 4' and '1' and ''
            // - 0 to 5:      /(\d){0,5, }/   -->   /(\d?(?: \d){0,4})/   matches matches '0 1' and '0 1 2 3 4'
            if(isCapture && this.options.enableLists && (r = REPETITION_EXP.exec(src.slice(lastIndex)))){
              var repConf = 0, repNumber = 1, repFinite = 2, repLimit = 3, repDelimiter = 4;
              capture.r = {
                capBound: [n, captures.length],
                expBound: [e + 4, e + sub.length + 4] // sub will wrapped with '(?:<sub>)' and '(<sub>)' w.r.t. '((?:<sub>))...' => the original <sub> pattern starts at position 'e' with an offset of 4: the length of the left wrapper '((?:'
              };
              (iList[capture.path] || (iList[capture.path] = [])).push(n - 1);
              if(r[repDelimiter]){
                // remove the captures in the repetition pattern
                var repetition = Exp.parse(PARENTHESIS, sub, function(m){ return m[1] || '(?:'; }).join('');
                sub = '(?:' + sub + ')' + (r[repNumber] !== '0'? '': r[repFinite]?'?':'{0}') + '(?:'+ r[repDelimiter] + '(?:' + repetition + ')' + '){' + (r[repNumber] === '0'? 0 : r[repNumber]-1) + r[repFinite] + (r[repLimit]? r[repLimit] === '0'? 0:r[repLimit]-1 :'') + '}';
              }else
                sub = '(?:' + sub + ')' + r[repConf];

              lastIndex += r[repConf].length;
            }

            exp += (isCapture ? '(' : '(?:') + sub + ')';

            // set the needles index back to
            needle.lastIndex = lastIndex;
            ns.pop();
          }
        }
        // add the appended native expression string to the compiled expression
        exp += src.slice(lastIndex);
      }

      return exp.replace(new RegExp('\\\\(' + escaped.join('|') + ')','g'),'$1'); // replace escaped characters
    },

    // executes the expresion on a given string.
    // As usually exec returns an array, but this one is populated with the named captures.
    // In the default settings they can be reached with match.$captureName while match is the returned array and $ the default prefix.
    exec: function(string){
      var match, m;

      this._exp.lastIndex = this.lastIndex;

      if(match = this._exp.exec(string)){
        this.lastIndex = this._exp.lastIndex;
        this.lastMatch = m = new Match(match, this);
        this.lastRange = m.range;
      }

      return  m || null;
    },

    // check if the expression matches the given string
    test: function(string){ return this._exp.test(string); },


    expand: function(source){
      return this.build(source, [],{});
    },

    error: function(msg){
      if(DEBUG_MODE === true){
        throw 'Error in Expression /' + this.source + '/: ' + msg;
      }
    },

    subExp: function(index){
      var
        i = index - this.offset,
        c = this._captures[i];

      if(c.r === undefined) return;

      c.e || (c.e = new Exp({
          source: sSlice.apply(this._exp.source, c.r.expBound),
          captures: [{}].concat(aSlice.apply(this._captures, c.r.capBound)),
          indices: this.indices,
          assignments: this.assignments,
          offset: c.r.capBound[0] - 1,
          global: true
        }));

      return this._captures[i].e;
    },

    SKIP: SKIP,
    BREAK: BREAK
  };


  var
    // Returns an array containing all matches/mappings of the given string.
    scan = Exp.scan = function(exp, string, mapper){
      var tokens = [], token, match, map = getMapper(mapper);
      // exp.lastIndex = 0;
      if(_.isFunction(exp.zero)) exp.zero();
      else exp.lastIndex = 0;

      while(match = exp.exec(string)){
        token = map.call(exp, match, tokens);

        if(token === BREAK) break;
        if(token !== SKIP) tokens.push(token);
        if(!exp.global) break;
      }

      // return _.extend(_(tokens),tokens, {length: tokens.length});
      return _.extend(new Match.Collection(tokens ),tokens, {length: tokens.length});
    },

    // return the first match in a string that is not the sipper obj
    search = Exp.search = function (exp, string, mapper) {
      var match, map = getMapper(mapper);
      scan(exp, string, function () {
        match = map.apply(this, arguments);
        return match !== SKIP? BREAK: match;
      });
      return match || null;
    },

    // returns an array containing all matches/mappings and the strings between
    parse = Exp.parse = function (exp, string, mapper) {
      var
        lastIndex = 0, line = 0, i = 0, strip, map = getMapper(mapper), br = /\n/g,

        tokens = scan(exp, string, function (match, tokens) {
          strip = string.slice(lastIndex, match.index);
          line += count(br, strip);

          match.i = ++i;
          match.line = line;

          if(match.index !== lastIndex) tokens.push(strip);
          line += count(br, match[0] || '');
          lastIndex = match.index + match[0].length; // to keep it compatible if no global flag is set, match.lastIndex cant be used here

          return map.call(exp, match, tokens);
        });
      if (lastIndex < string.length) tokens.push(string.slice(lastIndex));

      return tokens;
    },

    // replaces all matches with the mapper
    replace = Exp.replace = function (exp, string, mapper) {
      return parse.apply(this, arguments).join('');
    },

    // returns the number of matches in a string
    count = Exp.count = function (exp, string, mapper) {
      return scan.apply(this,arguments).length;
    };

    //dies ist ein test
    Exp.esc = esc;
  // extend prototype with featured methods
  _.each(['scan', 'search', 'parse','replace', 'count'], function(method){
    Exp.prototype[method] = function(){
      var arg = [this];
      aPush.apply(arg, arguments);

      return Exp[method].apply(this, arg);
    };
  });

  // default expessions settings
  var
    defaults = {
      enableLists: true,
      global: false,
      ignoreCase: false,
      multiline: false
    },
    specialOpt = ['source'];

  // helper
  var
    sSlice = String.prototype.slice,

    aSlice = Array.prototype.slice,

    aPush = Array.prototype.push,

    byLength = function(a,b){ return b.length - a.length;},

    getMapper = Exp.getMapper = function(mapper){
      var m, tokens, indices = {};
      if (typeof mapper !== 'string') return mapper || _.identity;

      tokens = parse(MARKER, mapper, function(m, t){
        indices[t.length] = m[1];
      }).value();

      return function(match){
        for(var i in indices)
          tokens[i] = indices[i] === '&'? match[0] : match.get? match.get(indices[i]) : match[indices[i]];
        return tokens.join('');
      };
    },
    //dies ist auch ein test
    findClosedReplacement = function (string){
      var opener = 1;
      return Exp.search(/\(|\)|\\\(|\\\)/g, string, function(match){
        if(match[0] === '('){opener++;}
        if(match[0] === ')'){opener--;}
        return opener === 0? string.slice(0,match.index) : SKIP;
      });
    };

  return Exp;
})();


// match class
var Match = (function(_){
	// var dummy = Exp('$^');
  var getCaptures = function(path){
    var
      p = path.split(SPLITTER),
      e = this._exp,
      that = this;

    // get listed captures (repetitions)
    var listCap = _
      .chain(e.indices.list)
      .map(function(index, listPath){
          return _
            .chain(p)
            .map(function(path){
              var pos = path.indexOf(listPath), subPath;

              subPath = pos === 0? path.slice(pos + listPath.length + 1) : path;

              if(!subPath || (pos !== 0 && path.indexOf(PATH_DELIMITER) !==-1) || !e.subExp(index))
                return false;

              return that.getSubMatches(index).map(function(match){
                return match.cap([subPath]);
              });

            })
            .compact()
            .value();
        })
      .flatten()
      .value();

    return _
      .chain(_.values(_.pick(e.indices.path, p)))
      .concat(_.values(_.pick(e.indices.name, p)))
      .flatten()
      .union()
      .map(function(index){
        return !this.isList(index)? this.getCapture(index) : this.getSubMatches(index);
      },this)
      .concat(listCap)
      .compact()
      .union()
      .value();
  };

  // The Match class
  var Match = Exp.Match = function(match, exp){
    if (match instanceof Match) return Match;
    if (!(this instanceof Match)) return new Match(match, exp);

    this._wrapped = this._match = match;
    this._exp = exp;
    this._getCaptures = _.memoize(getCaptures);
    this._subMatch = {};

    _.extend(this, match);

    this.match = match[0];
    this.length = match.length;
    this.lastRange = exp.lastRange;
    this.range = [match.index, exp.lastIndex];

    this["&"] = match [0]; // matched substring
    this["`"] = this.input.slice(0, this.index); // preceding string
    this["'"] = this.input.slice(exp.lastIndex); // following string
  };

  // result handler takes care of underscore chaining
  var result = function(obj, value){
    if(obj._chain){
      obj._wrapped = value;
      return obj;
    } else
      return value;
  };

  var proto = Match.prototype = _([]);

  proto.cap = proto.capture = function(path){
    var
      a = _.isArray(path),
      c = this._getCaptures(a? path.join(',') : path);

    return result(this, a? c : c[0]);
  };


  proto.atm = proto.attachment = function(path){
    var a = this.getAssignments();
    return path? resolvePath(path, a) : a;
  };

  //@deprecated
  proto.assignment = proto.atm;

  proto.get = function(path){
    var res;
    return (res = this.capture(path)) !== undefined ? res :
      (res  = this.assignment(path)) !== undefined ? res :
      (res = (path[0]==='$'? this[path.slice(1)] : this[path])) !== undefined? res :
      this[path];
  } ;

  proto.toString = function(){ return this._match[0]; };

  proto.getAssignments = function(){
    if(!this._assignments)
      this._assignments  = _.reduce(this._match, function(res, cap, i){
        var
          c = this._exp._captures[i],
          path,
          assignment,
          subAssignments,
          a;
        
        if(cap === undefined || !c.a)
          return res;

        assignment = resolvePath(c.a.path, this._exp.assignments);
        assignment = assignment[cap] || assignment;
        
        for(a in assignment)
          if(c.a.force || res[a] === undefined)
            res[a] = assignment[a];

        if(c.r && false)
          this.getSubMatches(i)
            .chain()
            .getAssignments()
            .each(function(assignment){
              var a;
              for(a in assignment)
                if(c.a.force || res[a] === undefined)
                  res[a] = assignment[a];
            });

        return res;
      },{},this);

    return result(this, this._assignments);
  };

  // returns the offseted index
  proto.getOffset = function(index){
    return index - this._exp.offset;
  };

  proto.getSubMatches = function(index){
    return this._subMatch[index] || (this._subMatch[index] = this._exp.subExp(index).scan(this._match[this.getOffset(index)]));
  };

  proto.getCapture = function(index){
    return this._match[this.getOffset(index)];
  };

  proto.isList = function(index){
    return !!this._exp._captures[this.getOffset(index)].r;
  };

  proto.$ = '$';

  Match.Collection = Collection.extend(Match, {
    bind:['get', 'cap', 'capture', 'atm', 'attachment', 'assignment', 'getAssignments']
  });

  return Match;
})(_);

Exp.VERSION = '0.2.1';

Exp.Collection = Collection;
Exp.Match = Match;

return Exp;
}));