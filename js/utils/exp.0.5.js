/**
 * expJS - modular expressions
 * @author Simon Bekoe
 * @version 0.5
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
		/** @const */ ATTRIBUTE_PREFIX = '$',
		/** @const */ ATTRIBUTE_DELIMITER = '_',
		/** @const */ DEBUG_MODE = true; // TODO: move to Exp.DEBUG_MODE

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
				escaped = [CAPTURE_PREFIX, INJECTION_PREFIX],
				wc = this.wildcards,
				settings = settings||{},
				w;

			for(w in wc){if(wc.hasOwnProperty(w)){
				if(w[0] === CAPTURE_PREFIX){w = w.slice(1); captures.push(w); escaped.push(w);}
				if(w[0] === INJECTION_PREFIX){ w = w.slice(1); injections.push(w); escaped.push(w);}
				names.push(w);
			}}
			this._captures = settings.captures || [''];
			this._assignments = {};
			this._escaped = escaped;
			this._needle = new RegExp('\\\\(' + escaped.join('|') + ')|(' + CAPTURE_PREFIX + '|' + INJECTION_PREFIX + ')(' + names.join('|') + ')|(' + (captures.join('|')||'$^') + ')|(' + (injections.join('|')||'$^') + ')','g');
			this._exp = new RegExp(
				this._captures.length>1?this.source : this.build(this.source, this._captures, this._assignments),
				this.flags || ((this.global? 'g' : '') + (this.ignoreCase? 'i' : '') + (this.multiline? 'm' : ''))
			);
		},

		/**
		 * Build the expression string with replaced wildcards
		 * @param {String} source
		 * @param {Array} captures Filled with the names
		 * @param {Array} [namespace] used internal for recursive call
		 * @return {String} native RegExp source
		 */
		build: function(source, captures, assignments, namespace){
			var wc = this.wildcards,
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
				replacement;
			if(!source){this.error('Empty Expression. Check the source or the "' + namespace[namespace.length-1] + '"wildcard');}
			while(match = needle.exec(source)) {
				// do nothing if an escaped characters was detected, but on captures and injections
				if (replacement = wc[match[3]] || wc[CAPTURE_PREFIX + match[4]] || wc[INJECTION_PREFIX + match[5]]) {
					// check if the the keyword is a capture
					isCapture = match[2] === CAPTURE_PREFIX || typeof match[4] !== 'undefined';
					keyword = match[3] || match[4] || match[5];
					// check for infinity recursion and add the current keyword to the namespace
					namespace.indexOf(keyword) === -1? namespace.push(keyword) : this.error('"'+ keyword + '" includes itself. This would end up in infinity recursion loop!');
					ns = namespace.join(ATTRIBUTE_DELIMITER);
					// store the keyword in the captures array if necessary
					if(isCapture){ captures.push(ns); }
					if(typeof replacement.assign !== 'undefined'){ assignments[ns] = replacement.assign; }
					// build the replacement recursive and wrap it with ( ) for capturing or (?: ) for injection
					replacement = (isCapture ? '(' : '(?:') + this.build(replacement.source || (replacement.join ? replacement.join('|') : replacement), captures, assignments, namespace) + ')';
					// add the prepended native expression string and the replacement to the compiled expression
					exp.push(source.slice(lastIndex, match.index), replacement);
					// set the needles index back to
					needle.lastIndex = lastIndex = match.index + match[0].length;
					namespace.pop();
				}
			}
			// add the appended native expression string to the compiled expression
			exp.push(source.slice(lastIndex));

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
			var match, i, captures = this._captures, assignments = this._assignments,assignment, attribute, a;
			this._exp.lastIndex = this.lastIndex;

			if(match = this._exp.exec(string)){
				this.lastIndex = this._exp.lastIndex;
				match.lastRange = this.lastRange;
				match.range = this.lastRange = [match.index, this._exp.lastIndex];
				for(i = 0; i<captures.length; i++){
					attribute = ATTRIBUTE_PREFIX + captures[i];


					if(!match[attribute]){ match[attribute] = [];}
					if(typeof match[i] !== 'undefined'){
						match[attribute].push(match[i]);
						if(assignment = assignments[captures[i]]){for(a in assignment){
							if(assignment.hasOwnProperty(a)){match[a] = assignment[a];}
						}}
					}
				}
			}
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
			var tokens = [], match;
			this.lastIndex = 0;
			if(this.global){ while(match = this.exec(string)){
				tokens.push(mapping? mapping.call(this, match, tokens) : match);
			}}
			return tokens;
		},

		expand: function(source){ return this.build(source, [],{}); },
		error: function(msg){ if(DEBUG_MODE === true){ throw 'Error in Expression /' + this.source + '/: ' + msg;} }
	};

	/**
	 * escape all RegExp characters in the given string - even the advaced ones
	 * based on http://simonwillison.net/2006/Jan/20/escape/ extended with the new characters "%" & ">"
	 * @param {string} string
	 * @param {boolean} nativeChars
	 * @return {string}
	 */
	Exp.esc = function(string, nativeChars){
		return string.replace(new RegExp('[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|' + (nativeChars? '' : '%#') +']','g'), "\\$&");
	};

	Exp.version = '0.4';

	// helper
	function replace(string, namespace, wildcards){

	}

return Exp;
}());