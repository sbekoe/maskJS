/**
 * expJS - modular expressions
 * @author Simon Bekoe
 * @version 0.7
 * https://gist.github.com/3726969
 * http://jsbin.com/ogokog/20/edit
 */

var Exp = (function(){
	"use strict";

	var
		/** @const */ INJECTION_PREFIX = '%',
		/** @const */ CAPTURE_PREFIX = '#',
		/** @const */ ASSIGNMENT_PREFIX = '>',
    /** @const */ PATH_DELIMITER = '.',
    /** @const */ PATH = "\\w+(?:\\.(?:\\w+|\\[\\d+\\]))*",
		/** @const */ ASSIGNMENT_EXP = new RegExp('('+ASSIGNMENT_PREFIX + '{1,2})(' + PATH + ')','g'),
		/** @const */ REPETITION_EXP = /^[*+]|^\{(\d+)(,?)(\d*)(?:,([^\}]+))?\}/,
		/** @const */ ATTRIBUTE_DELIMITER = '_',
		/** @const */ DEBUG_MODE = true; // TODO: move to Exp.DEBUG_MODE

	"use strict";

  var
    defaults = {

      // the attr to populate a match with
      captureIndices: false,
      capturePaths: false,
      captureName: true,

      captureRepetition: false
    },
    specialOpt = ['source'];

	/**
	 *  Epression class
	 * @constructor
	 * @param {String | RegExp | Object} exp
	 * @param {Object} [options] optional11
	 */
	function Exp(exp, options){
		var settings = options || exp || {};

		// initial properties
    //this.source = exp.source? exp.source.toString().slice(1,-1) : exp;
		this.source = exp.source? exp.source.toString() : exp;
		this.global = exp.global || settings.global;
		this.ignoreCase = exp.ignoreCase || settings.ignoreCase;
		this.multiline = exp.multiline || settings.multiline;

    this.options = _.extend({}, defaults, options, exp);
//    _.extend(this, _.pick(this.options, specialOpt));
    this.flags = settings.flags || '';
		this.wildcards = settings.wildcards || {};
		this.defaultMatch = settings.defaultMatch || null; // the defaultMatch is on RegExp execution if no match was found

    this.assignments = settings.assignments || {};

		// runtime properties
		this.lastIndex = settings.lastIndex || 0;
		this.lastRange = [0,0];

		this.compile(settings);
	}

	Exp.prototype = {
		/** @constructs */
		compile:function(settings){
			var
				names = [],
				injections = [],
				captures = [],
				escaped = ['\\(', '\\)', CAPTURE_PREFIX, INJECTION_PREFIX],
				wc = this.wildcards,
				settings = settings||{},
				w;

			for(w in wc){if(wc.hasOwnProperty(w)){
				if(w[0] === CAPTURE_PREFIX){w = w.slice(1); captures.push(w); escaped.push(w);}
				if(w[0] === INJECTION_PREFIX){ w = w.slice(1); injections.push(w); escaped.push(w);}
				names.push(w);
			}}
			this._captures = settings.captures || [{path:'', name:''}];
			this._escaped = escaped;
			this._needle = new RegExp(
				'\\\\(' + escaped.join('|') + ')|' +
        '\\((' + CAPTURE_PREFIX + '|' + INJECTION_PREFIX + ')(\\w+):|' + // opener of named inline capture/injection
        '(\\((?!\\?:))|' + // opening parenthesis for native capture resp. unnamed capture. but prevent from matching non-capturing parentheses: '(' but not '(?:'
        '(' + CAPTURE_PREFIX + '|' + INJECTION_PREFIX + ')(' + (names.sort(byLength).join('|')||'$^') + ')|' + // captures/injections named in wildcards
        '(' + (captures.join('|')||'$^') + ')|' + // predefined captures named in wildcards
        '(' + (injections.join('|')||'$^') + ')' + // predefined injections named in wildcards
				'', 'g'
			);

      var
        src = this._captures.length>1?this.source : this.build(this.source, this._captures),
        flags = this.flags || ((this.global? 'g' : '') + (this.ignoreCase? 'i' : '') + (this.multiline? 'm' : ''));

			this._exp = new RegExp(src, flags);
		},

		/**
		 * Build the expression string with replaced wildcards
		 * @param {String} source
		 * @param {Array} captures Filled with the names
		 * @param {Array} [namespace] used internal for recursive call
		 * @return {String} native RegExp source
		 */
		build: function(source, captures, namespace){
			var
				source = isArray(source)? source : [source],
				wc = this.wildcards,
				needle = this._needle, // regexp to detect the (escaped) special characters.
				escaped = this._escaped,

				// The namespace is a stack containing the keywords of the nested captures and injections
				// The name space is used to build the attribute name of a capture in a match. e.g: match.$keyword_nestedKeyword
				namespace = namespace || [],

				// Contains the elements of the compiled expression
				exp = '',
				lastIndex = needle.lastIndex = 0,
				keyword,
				isCapture,
        capture,
				match,
				// the expression that replaces the keyword
				replacement,
        sub,
				i, src, r, a, n, e;

			for(i=0; i<source.length; i++){
				src = source[i].hasOwnProperty('s')? source[i].s : source[i].hasOwnProperty('source')? source[i].source : source[i];
				if(!src){return '';}

				// disjunction of source elements
				if(i>0) exp += '|';

				while(match = needle.exec(src)) {
					// do nothing if an escaped characters was detected, but on captures and injections
					if (replacement = wc[match[6]] || wc[CAPTURE_PREFIX + match[7]] || wc[INJECTION_PREFIX + match[8]]  || (match[2]||match[4]? {s:findClosedReplacement(src.slice(needle.lastIndex)), a:source[i].a||source[i].assign} : false)) {
						// check if the the keyword is a capture
						isCapture = match[2] === CAPTURE_PREFIX || match[4] || match[5] === CAPTURE_PREFIX || typeof match[7] !== 'undefined';
						keyword = match[3] || match[6] || match[7] || match[8] || '';

						// check for infinity recursion and add the current keyword to the namespace
						namespace.indexOf(keyword) === -1? namespace.push(keyword) : this.error('"'+ keyword + '" includes itself. This would end up in infinity recursion loop!');

						// store the keyword in the captures array if necessary
						if(isCapture){
              n = captures.push(capture = {name: keyword, path: namespace.join(ATTRIBUTE_DELIMITER)});
              e = exp.length;
            }

						// add the prepended native expression string and the replacement to the compiled expression
						// the replacement expression is build recursive and wrapped with ( ) for capturing or (?: ) for injection
						sub = this.build(replacement.s || replacement.source || replacement, captures, namespace);
            exp += src.slice(lastIndex, match.index);

            lastIndex = match.index + match[0].length + (match[2]||match[4]? replacement.s.length + 1 : 0);
						// check for assignments
            ASSIGNMENT_EXP.lastIndex = lastIndex;

            if(isCapture && (a = ASSIGNMENT_EXP.exec(src))){
              lastIndex += a[0].length;
              capture.aForce = 2 === a[1].length;
              capture.aPath = a[2];
            }

            // check for repetitions
            //
            // separated repetitions
            // e.g a list of numbers (<\d>'s) separated by a whitespace
            // - exactly 5:   /(\d){5, }/     -->   /(\d(?: \d){4})/      matches '0 1 2 3 4'
            // - indefinite:  /(\d){0,, }/    -->   /(\d?(?: \d){0,})/    matches '0 1 2 3 4' and '1' and ''
            // - 0 to 5:      /(\d){0,5, }/   -->   /(\d?(?: \d){0,4})/   matches matches '0 1' and '0 1 2 3 4'
            if(isCapture && this.options.captureRepetition && (r = REPETITION_EXP.exec(src.slice(lastIndex)))){
              var repConf = 0, repNumber = 1, repFinite = 2, repLimit = 3, repDelimiter = 4;
              capture.rCapBound = [n, captures.length];
              capture.rExpBound = [e + 4, e + sub.length + 4]; // sub will wrapped with '(?:<sub>)' and '(<sub>)' w.r.t. '((?:<sub>))...' => the original <sub> pattern starts at position 'e' with an offset of 4: the length of the left wrapper '((?:'
              if(r[repDelimiter]){
                // remove the captures in the repetition pattern
                var repetition = Exp.parse(/(\\\(|\(\?[:=!])|\((?:#\w+:)?/g, sub, function(m){return m[1] || '(?:'}).join('');
                sub = '(?:' + sub + ')' + (r[repNumber]!=0?'':r[repFinite]?'?':'{0}') + '(?:'+ r[repDelimiter] + '(?:' + repetition + ')' + '){' + (r[repNumber]==0?0:r[repNumber]-1) + r[repFinite] + (r[repLimit]? r[repLimit]==0?0:r[repLimit]-1 :'') + '}';
              }else
                sub = '(?:' + sub + ')' + r[repConf];

              lastIndex += r[repConf].length;
            }

            exp += (isCapture ? '(' : '(?:') + sub + ')';

						// set the needles index back to
						needle.lastIndex = lastIndex
            namespace.pop();
					}
				}
				// add the appended native expression string to the compiled expression
				exp += src.slice(lastIndex);
			}

			return exp.replace(new RegExp('\\\\(' + escaped.join('|') + ')','g'),'$1'); // replace escaped characters
		},

		/**
		 * executes the expresion on a given string.
		 * As usually exec returns an array, but this one is populated with the named captures.
		 * In the default settings they can be reached with match.$captureName while match is the returned array and $ the default prefix.
		 * @param string
		 * @return {array}
		 */
		exec: function(string){
			var
        match,
        res;

			this._exp.lastIndex = this.lastIndex;

			if(match = this._exp.exec(string)){
        this.lastIndex = this._exp.lastIndex;

        res = _.reduce(match, matchExtender, {
          input:match.input,
          index:match.index,
          lastRange: this.lastRange,
          range: (this.lastRange = [match.index, this._exp.lastIndex]),
          match: match[0],
          length:match.length
        }, this);

			}

      this.lastMatch = res || this.lastMatch;
			return  res || this.defaultMatch;
    },

		/**
		 * check if the expression matches the given string
		 * @param {string} string
		 * @return {Boolean}
		 */
		test: function(string){ return this._exp.test(string); },

		/**
		 * Returns an array containing all matches of the given string.
		 * This makes only sence, if the global flag is true
		 * @param {string} string
		 * @param {function(this:Exp,Array,Array): *} mapping
		 * @return {Array}
		 */
		scan: function(string,mapping){
			return Exp.scan(this, string, mapping);
		},

		expand: function(source){
			return this.build(source, [],{});
		},
		error: function(msg){
			if(DEBUG_MODE === true){
				throw 'Error in Expression /' + this.source + '/: ' + msg;
			}
		}
	};

	/**
	 * Returns an array containing all matches of the given string.
	 * This makes only sence, if the global flag is true
	 * @param {RegExp|Exp} exp
	 * @param {String} string
	 * @param {function(this:Exp,Array,Array): *} mapper the iterator function (optional)
	 * @return {Array}
	 */
	var scan = Exp.scan = function(exp, string, mapper){
		var tokens = [], token, match;
		exp.lastIndex = 0;
		if(exp.global){ while(match = exp.exec(string)){
			token = mapper? mapper.call(exp, match, tokens) : match;
			if(token === Exp.breaker){break;}
			else if(token !== Exp.skipper) tokens.push(token);
		}}
		return tokens;
	}

	Exp.search = function(exp, string, mapper){
		var token, match, lastIndex = exp.lastIndex;
		exp.lastIndex = 0;
		if(exp.global){ while(match = exp.exec(string)){
			token = mapper? mapper.call(exp, match) : match;
			if(token !== Exp.skipper) return token;
		}}
		// exp.lastIndex = lastIndex; // TODO: proof sense
		return null;
	}

  var parse = Exp.parse = function(exp, string, mapper){
    var
      lastIndex = 0,
      line = 0,
      strip,
      tokens = scan(exp, string, function(match, tokens){
        strip = string.slice(lastIndex, match.index);
        line += count(/\n/g, strip);
        match.line || (match.line = line);
        if(match.index !== lastIndex) tokens.push(strip);
        line += count(/\n/g, match[0]||'');
        lastIndex = exp.lastIndex;
        return mapper? mapper.call(exp, match, tokens) : match;
      });
      if(lastIndex < string.length) tokens.push(string.slice(lastIndex));
    return tokens;
  }

  var count = Exp.count = function(exp, string){
    return scan(exp, string).length;
  }

	/**
	 * return Exp.breaker in iterators to quit the iteration loop.(scan, search)
	 * @type {Object}
	 */
	Exp.breaker = {};

	/**
	 * return Exp.skipper in iterators to skip the current iteration. E.g. the tokens returned by Exp.scan wouldn't contain the match on which the iterator returned the skipper.
	 * @type {Object}
	 */
	Exp.skipper = {};

	/**
	 * escape all RegExp characters in the given string - even the advaced ones
	 * based on http://simonwillison.net/2006/Jan/20/escape/ extended with the new characters "%" & ">"
	 * @param {string} string
	 * @param {boolean} nativeCharsOnly
	 * @return {string}
	 */
	Exp.esc = function(string, nativeCharsOnly){
    !isArray(string) || (string = string.join(''));
		return string.replace(new RegExp('[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|' + (nativeCharsOnly? '' : '%#') +']','g'), "\\$&");
	};

	Exp.s = function(exp, settings){return new Exp(exp,settings);};

	Exp.version = '0.6';

	// helper
	var
    isArray = Array.isArray || function(a) { return Object.prototype.toString.call(a) === '[object Array]';},
		byLength = function(a,b){ return b.length - a.length;},
		findClosedReplacement = function (string){
			var opener = 1;
			return Exp.search(/\(|\)|\\\(|\\\)/g, string, function(match){
				if(match[0] === '('){opener++;}
				if(match[0] === ')'){opener--;}
				return opener === 0? string.slice(0,match.index) : Exp.skipper;
			});
    },

    resolvePath = function(path, obj, delimitter){
      delimitter = delimitter || '.';
      obj = obj || window; // TODO: remove the window alternative
      path = (path + '').split(delimitter);
      try{ return eval('(obj["' + path.join('"]["') + '"])'); }
      catch(e){ return undefined; }
    },

    matchExtender = function(result, capture, index){
      var
        cap = this._captures[index],
        c = cap.path,
        name = cap.name,
        a;

      // resolve repetitions
      if(cap.rCapBound && cap.rExpBound){
        capture = Exp.s({
          source: this._exp.source.slice(cap.rExpBound[0], cap.rExpBound[1]),
          captures: [{path:'', name:''}].concat(this._captures.slice(cap.rCapBound[0], cap.rCapBound[1])),
          assignments: this.assignments,
          global:true
        }).scan(capture);
      }

      // extend with capture index
      !this.options.captureIndices || (result[index] = capture);

      // exetend with capture names
      if(this.options.captureName && c !== '' && capture !== undefined){
        result[name] || (result[name] = []);

        result[name].push(capture);
      }

      // extend with capture path
      if(this.options.capturePaths && ( name !== c) &&  c !== '' && capture !== undefined){
        result[c] || (result[c] = []);
        result[c].push(capture);
      }

      // extend with capture assignment
      if(capture !== undefined && cap.aPath && (a = resolvePath(cap.aPath, this.assignments))){
        a = a[capture] || a;
        if(cap.aForce)
          _.extend(result, a)
        else
          for(var k in a)
            if(result[k] === undefined) result[k] = a[k];
      }
      return result;
    };


return Exp;
}());