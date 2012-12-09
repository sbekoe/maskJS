/**
 * expJS - modular expressions
 * @author Simon Bekoe
 * @version 0.6
 * https://gist.github.com/3726969
 * http://jsbin.com/ogokog/20/edit
 *
 * Valid calls are:
 *     new Exp(string:expression, object:settings)	// e.g. new Exp("expression", {wildcards: {"keyword":"expression"}, flags:'igm'})
 *     new Exp(regExp:expression, object:settings)	// e.g. new Exp(/expression/igm, {wildcards: {"keyword":"expression"}})
 *     new Exp(object:settings) 					// e.g. new Exp({source: "expression", wildcards: {"keyword":"expression"}})
 *
 * Settings ([optional]):
 * 	{object} wildcards		object map with attributes specifying the keywords and values specifying the expressions the keyword is replaced through. e.g.:
 * 		{
 * 		 // Captures like #name will be stored in match.$tag_name
 * 		 // Here the %name will include the same expression like #expression but without capturing its match.
 * 		 "tag": /< #name\ id = "#id" >#content< \/%name>/,
 *
 * 		 // The expression assigned to a keyword can hold further injections and captures.
 * 		 // So the keywords are resolved recursive (since version 0.4).
 * 		 // If an keywords expression contains itslefs, an error event is thrown.
 * 		 "name": "%w",
 *
 * 		 "id": "%w",
 * 		 "content": ".*",
 *
 * 		 // a keywords first character can be the injetion or capture prefix "%"/"#".
 * 		 // In this case, it's allowd to use the keyword in expressions without prefixing it.
 * 		 // So in this example a whitespace respresents the expression \\s* and keeps the tag expression (above) cleaner.
 * 		 "% ": "\\s*",
 * 		 "w": "\\w+"
 * 		}
 *	{string} [flags]		the expressions flags delevered to new RegExp(epression, flags)
 *	{boolean} [global]		alternative to the flags option
 *	{boolean} [ignoreCase]	alternative to the flags option
 *	{boolean} [multiline]	alternative to the flags option
 *	{*} [defaultMatch]		if the excution fails the defaultMatch is returned instead of null
 *
 */

var Exp = (function(){
	"use strict";

	var
		/** @const */ INJECTION_PREFIX = '%',
		/** @const */ CAPTURE_PREFIX = '#',
		/** @const */ ASSIGNMENT_PREFIX = '>',
		/** @const */ ATTRIBUTE_PREFIX = '$',
		/** @const */ ATTRIBUTE_DELIMITER = '_',
		/** @const */ DEBUG_MODE = true; // TODO: move to Exp.DEBUG_MODE

	"use strict";

	/**
	 *  Epression class
	 * @constructor
	 * @param {String | RegExp | Object} exp
	 * @param {Object} [settings] optional
	 */
	function Exp(exp, settings){
		var settings = settings || exp || {};

		// initial properties
//		this.source = exp.source? exp.source.toString().slice(1,-1) : exp;
		this.source = exp.source? exp.source.toString() : exp;
		this.global = exp.global || settings.global;
		this.ignoreCase = exp.ignoreCase || settings.ignoreCase;
		this.multiline = exp.multiline || settings.multiline;
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
			this._captures = settings.captures || [''];
			this._assignments = [{}];
			this._escaped = escaped;
			this._needle = new RegExp(
				'\\\\(' + escaped.join('|') + ')|' +
				//'(?:' +
					'\\((' + CAPTURE_PREFIX + '|' + INJECTION_PREFIX + ')(\\w+):|' + // opener of named inline capture/injection
					'(\\((?!\\?:))|' + // opening parenthesis for native capture resp. unnamed capture. but prevent from matching non-capturing parentheses: '(' but not '(?:'
					'(' + CAPTURE_PREFIX + '|' + INJECTION_PREFIX + ')(' + (names.sort(byLength).join('|')||'$^') + ')|' + // captures/injections named in wildcards
					'(' + (captures.join('|')||'$^') + ')|' + // predefined captures named in wildcards
					'(' + (injections.join('|')||'$^') + ')' + // predefined injections named in wildcards
				//')(' + ASSIGNMENT_PREFIX + '\\w+)?' +
				'', 'g'
			);
			this._exp = new RegExp(
				this._captures.length>1?this.source : this.build(this.source, this._captures, this._assignments),
				this.flags || ((this.global? 'g' : '') + (this.ignoreCase? 'i' : '') + (this.multiline? 'm' : ''))
			);
		},

		/**
		 * Build the expression string with replaced wildcards
		 * @param {String} source
		 * @param {Array} captures Filled with the names
		 * @param {Object} assignments Filled with the names
		 * @param {Array} [namespace] used internal for recursive call
		 * @return {String} native RegExp source
		 */
		build: function(source, captures, assignments, namespace){
			var
				source = isArray(source)? source : [source],
				wc = this.wildcards,
                _assignments = this.assignments,
				needle = this._needle, // regexp to detect the (escaped) special characters.
				escaped = this._escaped,
				namespaces = namespaces || {},

				// The namespace is a stack containing the keywords of the nested captures and injections
				// The name space is used to build the attribute name of a capture in a match. e.g: match.$keyword_nestedKeyword
				namespace = namespace || [],
				ns,
				// Contains the elements of the compiled expression
				exp = [],
				lastIndex = needle.lastIndex = 0,
				keyword,
				isCapture,
				match,
				// the expression that replaces the keyword
				replacement,
				openers,
				i,src,inlineAssignment;
			for(i=0; i<source.length; i++){
				src = source[i].hasOwnProperty('s')? source[i].s : source[i].hasOwnProperty('source')? source[i].source : source[i];
//				src = source[i].s || source[i].source || source[i];
				if(!src){return '';}
//				if(!src){this.error('Empty Expression. Check the source or the "' + namespace[namespace.length-1] + '"wildcard');}
				// disjunction of source elements
				if(i>0){exp.push('|')}
				while(match = needle.exec(src)) {
					// do nothing if an escaped characters was detected, but on captures and injections
					if (replacement = wc[match[6]] || wc[CAPTURE_PREFIX + match[7]] || wc[INJECTION_PREFIX + match[8]]  || (match[2]||match[4]? {s:findClosedReplacement(src.slice(needle.lastIndex)), a:source[i].a||source[i].assign} : false)) {
						// check if the the keyword is a capture
						isCapture = match[2] === CAPTURE_PREFIX || match[4] || match[5] === CAPTURE_PREFIX || typeof match[7] !== 'undefined';
						keyword = match[3] || match[6] || match[7] || match[8] || captures.length;
						// check for infinity recursion and add the current keyword to the namespace
						namespace.indexOf(keyword) === -1? namespace.push(keyword) : this.error('"'+ keyword + '" includes itself. This would end up in infinity recursion loop!');
						ns = namespace.join(ATTRIBUTE_DELIMITER);
						// store the keyword in the captures array if necessary
						if(isCapture){
                            captures.push(ns);
                            /** @deprecated */
                            assignments.push(replacement.a || replacement.assign || {});
                        }

						if(match[9]){

						}

						// add the prepended native expression string and the replacement to the compiled expression
						// the replacement expression is build recursive and wraped with ( ) for capturing or (?: ) for injection
						exp.push(
							src.slice(lastIndex, match.index),
							(isCapture ? '(' : '(?:') + this.build(replacement.s || replacement.source || replacement, captures, assignments, namespace) + ')'
						);
                        lastIndex = match.index + match[0].length + (match[2]||match[4]? replacement.s.length + 1 : 0);
						// check for inline assignments
                        //*
                         if(isCapture && (inlineAssignment = src.match(new RegExp(ASSIGNMENT_PREFIX + '(\\w+)'))) && _assignments[inlineAssignment[1]]){
                            lastIndex += inlineAssignment[0].length;
                            assignments[assignments.length-1] = _assignments[inlineAssignment[1]];
						}
                        //*/
						// set the needles index back to
						needle.lastIndex = lastIndex
						namespace.pop();
					}
				}
				// add the appended native expression string to the compiled expression
				exp.push(src.slice(lastIndex));
			}

			return exp.join('').replace(new RegExp('\\\\(' + escaped.join('|') + ')','g'),'$1'); // replace escaped characters
		},

		/**
		 * executes the expresion on a given string.
		 * As usually exec returns an array, but this one is populated with the named captures.
		 * In the default settings they can be reached with match.$captureName while match is the returned array and $ the default prefix.
		 * @param string
		 * @return {array}
		 */
		exec: function(string){
			var match,
                i,
                captures = this._captures,
                assignments = this._assignments,
                assignment,
                namespace,
                attribute,
                attr,
                a;
			this._exp.lastIndex = this.lastIndex;

			if(match = this._exp.exec(string)){
				this.lastIndex = this._exp.lastIndex;
				match.lastRange = this.lastRange;
				match.range = this.lastRange = [match.index, this._exp.lastIndex];
				for(i = 0; i<captures.length; i++){
					namespace = ATTRIBUTE_PREFIX + captures[i];
					attribute = ATTRIBUTE_PREFIX + (attr = captures[i].slice(captures[i].lastIndexOf('_')+1));


					if(!match[namespace]){ match[namespace] = [];}
					if(!match[attribute]){ match[attribute] = [];}
					if(typeof match[i] !== 'undefined'){
						match[namespace].push(match[i]);
						if(attribute !== namespace && captures.indexOf(attr) === -1){match[attribute].push(match[i]);}
//						if(assignment = assignments[i]){for(a in assignment){

						if(assignment = assignments[i][match[i]] || assignments[i]){for(a in assignment){
							if(assignment.hasOwnProperty(a)){match[a] = assignment[a];}
						}}
					}
				}
			}
			this.lastMatch = match || this.lastMatch;
			return match || this.defaultMatch;
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
	Exp.scan = function(exp, string, mapper){
		var tokens = [], token, match, lastIndex = exp.lastIndex;
		exp.lastIndex = 0;
		if(exp.global){ while(match = exp.exec(string)){
			token = mapper? mapper.call(exp, match, tokens) : match;
			if(token === Exp.breaker){break;}
			else if(token !== Exp.skipper) tokens.push(token);
		}}
		// exp.lastIndex = lastIndex; // TODO: proof sense
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
		return string.replace(new RegExp('[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|' + (nativeCharsOnly? '' : '%#') +']','g'), "\\$&");
	};

	Exp.s = function(exp, settings){return new Exp(exp,settings);};

	Exp.version = '0.6';

	// helper
	var isArray = Array.isArray || function(a) { return Object.prototype.toString.call(a) === '[object Array]';},
		byLength = function(a,b){ return b.length - a.length;},
		findClosedReplacement = function (string){
			var opener = 1;
			return Exp.search(/\(|\)|\\\(|\\\)/g, string, function(match){
				if(match[0] === '('){opener++;}
				if(match[0] === ')'){opener--;}
				return opener === 0? string.slice(0,match.index) : Exp.skipper;
			});
		};


return Exp;
}());