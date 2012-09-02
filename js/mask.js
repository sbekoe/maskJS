/**
 * mask.js
 * @fileOverview fileDescription
 * @author Simon Bekoe
 * @version $Id$
 */

window.Mask = window.Mask ||  (function(window, doument, undefined){
	"use strict";
	// default options
	var defaults = {
		marker:{
			//'i': function(i){return i;}
		},
		cache:true,

		/**
		 * can be:
		 *  - Array of patterns: ['{{%s%id%s}}','{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->']
		 *  - String which lends to a preset: 'def', 'html', 'js', 'css', 'mustache
		 */
		pattern: 'html' // Array of Patterns
	};

	/**
	 * Represents a Template
	 * @constructor
	 * @property {Array} tokens The compiled template
	 * @property {String} template The template source
	 * @property {Object} options The options for this template. They extend the default options.
	 * @property {Tokenizer} tokenizer The tokenizer object initialized with options.pattern. tokenizer.exp contains the regExp to compile this template
	 * @property {Scope} scope The Scope represents the data closure while rendering the template.
	 * @param {String} template
	 * @param {Object} options
	 */
	function Mask(template,options){
		this.template = template;
		this.options = extend({},defaults,options);
		this.init();
	}

	Mask.prototype = {
		/**
		 * Initialize the template by
		 *   - building the tokenizer expression to detect markers
		 *   - instantiating the data scope for rendering
		 *   - compiling or using cache
		 * @memberOf Mask#
		 * @constructs
		 * @this {Mask}
		 */
		init: function(){
			this.tokenizer =  new Tokenizer(this.options.syntax);
			this.scope = new Scope({},defaults.marker,this.options.marker);
			this.tokens = this.options.cache && cache[this.template]? cache[this.template] : (cache[this.template] = this.compile(this.template));
		},

		/**
		 * Render the template with data
		 * @param {Object} data
		 * @return {String}
		 */
		render: function (data) {
			if (!isArray(data)) {
				data = [data];
			}
			var tokens = arguments[1] || this.tokens, 	// a peace of compiled template
				result = [], 								// array of strings
				length = data.length,
				logic = this.tokenizer.options.logic,
				marker, pos, d, i, m;
			this.scope[0].length = length;
			// iterate trough data
			for(i = 0; i<length;i++){
				if(data[i]!==null && typeof data[i] !== 'undefined'){
					this.scope.push(data[i]);
					this.scope[0].i = i;
					// iterate trough the markers of the current template
					for(m in tokens.marker){if(tokens.marker.hasOwnProperty(m)){
						// get the default data associated with the name m
						d = this.scope.find(m);
						// iterate trough the positions the current marker should be inserted at
						for(pos in tokens.marker[m]){if(tokens.marker[m].hasOwnProperty(pos)){
							marker = tokens.marker[m][pos];
							// use a given data handler instead of the default data
							d = logic[marker.l].handle? logic[marker.l].handle.apply({scope:this.scope, data:d, length:length, i:i}, marker.params) : d;
							switch(typeof d){
								case 'string':
								case 'number': tokens.template[pos] = d; break;
								case 'object': tokens.template[pos] = logic[marker.l].render? logic[marker.l].render.call(this, d, marker.nested) : this.render(d,marker.nested); break;
								case 'function': tokens.template[pos] = d.call(this, marker); break;
								default: tokens.template[pos] = '';
							}
							//tokens.template[pos] = t === 'object'? this.render(d,marker.nested) : t==='function'? d.call(this,i,m) : d;
						}}
					}}
					result = result.concat(tokens.template);
					this.scope.pop();
				}
			}
			return result.join('');
		},


		/**
		 * Compile the template recursive
		 * if options.cache is true, this function is called once for each template
		 *
		 * @param {String} template
		 * @returns {String[]}
		 *
		 * @example
		 * <ul class="{{top}}">
		 *     <!--nested--><li>{{item}}</li><!--/nested-->
		 * </ul>
		 *
		 * is compiled to an array/object of the following structure:
		 *
		 * Array[5]
		 * 	0: "<ul class=""
		 * 	1: ""
		 * 	2: "">"
		 * 	3: ""
		 *	4: "</ul>"
		 * 	length: 5
		 * 	marker: Object
		 * 		nested: Object
		 * 			3: Array[3]
		 * 				0: "<li>"
		 * 				1: ""
		 * 				2: "</li>"
		 * 				length: 3
		 * 			marker: Object
		 * 				item: Object
		 * 					1: ""
		 * 		top: Object
		 * 			1: ""
		 *
		 */
 		compile: function(template){
			if(!template){
				return {};
			}
			var t = this.tokenizer,
				logic = t.options.logic,
				tokens = {template:[], marker:{}, partial:{}},
				scope = {count:0, last:0, next:0, m:{}, d: new RegExp(t.detector,'gm')},
				m;
			//*
			while(m=this.tokenizer.parse(template,scope)){
				if(m.closed === true){
					if(m.type == 'nested'){
						m.nested = logic[m.l].compile? logic[m.l].compile.call(this, template, m, tokens, scope) : this.compile(template.slice(m.inner[0], m.inner[1]));
					}
					tokens.template.push(template.slice(scope.last, m.outer[0]),'');
					// if no markers are detected until now, create an object for them
					tokens.marker[m.id] = tokens.marker[m.id] || {};
					// associate position & template with marker.
					tokens.marker[m.id][tokens.template.length-1] = m;
				}
			}
			tokens.template.push(template.slice(scope.next));
			return tokens.template.length? tokens : this.tokens;
		}
	};

	/**
	 * Create new Scope
	 * The scope enables the injection of data from lower recursion levels into a nested template. It is technically a stack.
	 * @constructor
	 * @property {Number} length number of elements in the stack
	 * @borrows Array#push as this.push
	 * @borrows Array#pop as this.pop
	 */
 	function Scope(){
		for(var i=0; i<arguments.length;i++){
			this.push(arguments[i]);
		}
	}

	Scope.prototype = {
		length:0,
		push: Array.prototype.push,
		pop: Array.prototype.pop,
		find: function(namespace){
			if(typeof namespace === 'string' && namespace.length){
				for(var i = this.length - 1, ns = namespace.split(/\W+/); i+1; i--){
					if(typeof this[i][ns[0]] !== 'undefined'){
						return ns.length == 1? this[i][ns[0]] : this.resolveNamespace(ns, this[i]);
					}
				}
			}
		},
		resolveNamespace: function(ns,root){
			for(var i= 0, o = root; i<ns.length; i++){
				if(typeof o[ns[i]] === 'undefined'){
					return undefined;
				}
				o = o[ns[i]];
			}
			return o;
		}

	};

	/**
	 * Create new Tokenizer
	 * Used to build the regexp to detect the markers of a template
	 * @constructor
	 * @param {String|Object} options
	 */
	function Tokenizer(options){
		this.init(options);
	}

	Tokenizer.prototype = {
		presets: {
			/*def:{
				//logic:[], wildcards:[], ...
				matchPositions:{},
				exp: /(\{\{\s*|\{\{\s*)(\w+)(?:\s*:)?|(\s*\}\}|\s*\}\})/g
			},*/
			html:{
				detector: "(\\{\\{|(?:^[ \\t]*)?<!\\-\\-[ \\t]*)(?:(\\w+(?:\\.\\w+)*)(?:(==|!=|<|>|<=|>=)(\\w+(?:\\.\\w+)*))?\\?(\\w+(?:\\.\\w+)*)(?:\\:(\\w+(?:\\.\\w+)*))?|(\\w+(?:\\.\\w+)*))(?:[ \\t]*\\-\\->(?:[ \\t]*\\n)?)?|(\\}\\}|(?:^[ \\t]*)?<!\\-\\-[ \\t]*\\/(\\w+(?:\\.\\w+)*)[ \\t]*\\-\\->(?:[ \\t]*\\n)?|[ \\t]*\\-\\->(?:[ \\t]*\\n)?)",
				indices:{"opener":1,"closer":8,"logic":[{"params":["comp1","rel","comp2","id","els"],"id":3,"start":2,"end":7,"check":5},{"params":[""],"id":0,"start":7,"end":8,"check":7}],"id":9,"i":2}
			},
			js:{
				items:['{{%s%id%s}}', '/*%s%id%s*/%tmp/*%s/%id%s*/', '//%s%id%s%n%tmp///%s%id'],
				exp: /(\{\{\s*|\/\*\s*|\/\/\s*)(\w+)(?:\s*\*\/|\s*\n)?|(\s*\}\}|\/\*\s*\/(\w+)\s*\*\/|\/\/\/\s*(\w+))/g
			},
			css:{
				items:['{{%s%id%s}}', '/*%s%id%s*/%tmp/*%s/%id%s*/'],
				exp: /(\{\{\s*|\/\*\s*|\/\/\s*)(\w+)(?:\s*\*\/|\s*\n)?|(\s*\}\}|\/\*\s*\/(\w+)\s*\*\/|\/\/\/\s*(\w+))/g
			},
			mustache:{
				items:['{{%s%id%s}}','{{#%id}}%tmp{{/%id}}'],
				exp: /(\{\{\s*|\{\{#)(\w+)(?:\}\})?|(\s*\}\}|\{\{\/(\w+)\}\})/g
			}
		},

		defaults: {
			marker:{
				logic: '%logic',
				nested: '%tmp',
				id:'%id' //TODO: add a third special wildcard %id
				//comment:'%comment'
			},
			wildcards: [
				['%id','(%ns)'],				// id for closing marker
				['%ns','%w(?:\\.%w)*'],			// the namespace to be resolved while getting data
				['%ls', '(?:^[ \\t]*)?'],		// line start
				['%le', '(?:[ \\t]*\\n)?'],		// line end
				['%n', '\\n'],					// line break
				['%s', '[ \\t]*'],				// white space (no line breaks)
				['%w', '\\w+']					// word
			],
			logic:[
				/* possible attributes, methods are optional
				{
					exp:'',
					handle:function(){ return {};},
					render:function(data, tokens){ return '';}, // context: Mask template
					compile:function(template, marker, tokens, scope){ return {};} // context: Mask template
				},
				//*/
				{exp: '(%ns)(?:(==|!=|<|>|<=|>=)(%ns))?\\?(%ns)(?:\\:(%ns))?', handle:function(comp1, rel, comp2, id, alt){
					var _id = this.scope.find(id),
						_v1 = this.scope.find(comp1),
						v1 = _v1 || comp1,
						v2 = this.scope.find(comp2) || comp2,
						v4 = this.scope.find(alt) || alt;
					switch(rel){
						case '==': return v1 == v2? _id : v4;
						case '!=': return v1 != v2? _id : v4;
						case '<': return v1 < v2? _id : v4;
						case '>': return v1 > v2? _id : v4;
						case '<=': return v1 <= v2? _id : v4;
						case '>=': return v1 >= v2? _id : v4;
						default: return _v1? _id : v4;
					}
				}},
				{exp: '(%ns)', handle:false}
			]
		},

		/** @constructs */
		init: function(options){
			options = typeof options ==='object'? options : this.presets[options] || this.presets['html'];

			this.options = extend({},this.defaults,this.defaults[options.presets]||{},options,true);
			if(options.detector){
				this.detector = this.options.detector;
				this.indices = this.options.indices;
				return;
			}

			this.opener = [];
			this.closer = [];
			this.divider = [];
			this.selector = [];
			this.indices = {opener:1, closer:0, logic:[], id:[],i:2};
			this.detect = /r/;

			this.analyse();
			this.build();
		},

		// concatenate the sub pattern to a regex & substitute wildcards
		build: function(){
			var exp = '(' + this.opener.join('|') + ')(?:' + this.selector.join('|') + ')(?:' + this.divider.join('|') + ')?|(' + this.closer.join('|') + ')',// + (this.comment.length? '|('+this.comment.join('|')+')' : '()'),
				wc = this.options.wildcards,
				i;

			for(i=0;i<wc.length;i++){
				exp = exp.replace(new RegExp(wc[i][0],'g'), wc[i][1]);
			}
			this.detector = exp;
		},

		analyse: function(){
			var pattern = this.options.pattern,
				logic = this.options.logic,
				single = new RegExp('^(.+)' + this.options.marker.logic + '()(.+)$'),
				nested = new RegExp('^(.+)' + this.options.marker.logic + '(?:(.*)' + this.options.marker.nested + ')(.+(%id).*|.+)$'),
				pos = 2,
				i, match, id, params;

			// build the selector regexp part
			for(i=0; i< logic.length; i++){
				params = logic[i].params? logic[i].params : logic[i].handle.toString().substring(logic[i].handle.toString().indexOf('(')+1, logic[i].handle.toString().indexOf(')')).split(/\W+/);
				this.indices.logic[i] = {
					params: params,
					start: pos,
					end: pos + params.length
				};
				pos += params.length;
				this.selector.push(logic[i].exp);
			}
			// save the match index of the closer
			this.indices.closer = pos;
			pos ++;
			// save the first match index of closing id's
			this.indices.id = pos;

			// split pattern into opener, divider & closer
			for(i = 0; i < pattern.length; i++){
				if((match = pattern[i].match(nested) || pattern[i].match(single)) && match[1] && match[3]){
					this.opener.push(this.esc(match[1]));
					this.closer.push(this.esc(match[3]));
					if(match[2]){
						this.divider.push(this.esc(match[2]));
						this.closer.push(this.esc(match[2]));
					}
					if(match[4]){
						pos++;
					}

				}
			}
		},
		parse:function(template, scope){
			var match, m = scope.m, id;
			if((match = scope.d.exec(template)) !== null || scope.count){
				// found opening marker
				if(match && match[this.indices.opener]){
					// get marker instance if there are no previous unclosed markers
					if(scope.count === 0){
						m = scope.m = this.getMarker(match); // marker itself
						m.status = 'opened';
					}
					// remember: one more marker is opened
					scope.count++;
				}
	
				// found closing marker
				else if(m.status === 'opened' && match && match[this.indices.closer]){
					// get the closing id if available
					id = match.slice(this.indices.id).join('');
					// check if the number of opened markers matches the number of closed markers and check available closing id against the opening id
					if(scope.count === 1 && (!id || m.params.indexOf(id)>-1)){
						m.id = id || m.id;
						m.type = 'nested';
						m.inner[1] = match.index;
						m.outer[1] = match.index + match[0].length;
						m.status = 'done';
					}
					// remember one marker less is opened
					if(scope.count>0){scope.count--;}
				}
	
				if(m.status === 'done' || !match){
					m.closed = true;
					m.status = 'closed';
					scope.count = 0;
					// update the expression index for the next loop
					scope.last = scope.next;
					scope.d.lastIndex = scope.next = match? m.outer[1] : m.end;
				}else{
					m.closed = false;
				}
				return m; // return the marker object while parsing is still in progress
			}else{
				return null;
			}
		},
		/**
		 * prepare a match
		 * @param match
		 * @return {Object}
		 */
		getMarker: function(match){
			var logic = this.options.logic,
				indices = this.indices.logic;

			for(var i= 0, p, s, e; i<logic.length; i++){
				if((p = match.slice(indices[i].start, indices[i].end)).join('')){
					return {
						l:i, 								// index of the logic selector
						params:p,
						id:p[0],							// use the first param of the selector as default
						start:match.index,
						end:match.index+match[0].length,
						inner:[match.index+match[0].length],
						outer:[match.index,match.index+match[0].length],
						opened:match[0],
						nested:[],
						type:'single',						// can be single or nested. single is the default  
						closed:false
					};
				}
			}
			return null;
		},


		// escape regexp chars //TODO: test if the escaping of  "-" is correct
		esc: function (str) {
			return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
		}
	};

	/**
	 * Shorthand for new Mask(template, options)
	 * @param {String} template
	 * @param {Object} options
	 * @returns {Mask}
	 */
	Mask.t = function(template,options){ return new Mask(template,options); };

	var cache = Mask.cache = {};
	var isArray = Mask.isArray =  Array.isArray || function(a) { return Object.prototype.toString.call(a) === '[object Array]'; };
	var extend = Mask.extend = function(o){
		var l = arguments.length,
			recursive = typeof arguments[l-1] ==='boolean' && arguments[l-1]===true,
			options = recursive ? Array.prototype.slice.call(arguments,0,l-1) : arguments,
			i, a;

		for(i = 0; i<options.length; i++){
			for(a in options[i]){
				if(options[i].hasOwnProperty(a)){
					if(recursive && isArray(options[i][a]) && isArray(o[a])){
						o[a] = options[i][a].concat(o[a]);
					}else if(recursive && typeof options[i][a]==='object' && typeof o[a]==='object'){
						o[a] = extend(o[a],options[i][a],true);
					}else{
						o[a] = options[i][a];
					}
				}
			}
		}
		return o;
	};
	return Mask;
})(window, document);