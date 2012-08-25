/**
 * mask.js
 * @fileOverview fileDescription
 * @author Simon Bekoe
 * @version $Id$
 */

window.Mask = window.Mask ||  (function(){
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
			var tokens = arguments[1] || this.tokens,
				res = [],
				l = data.length,
				d, i, m, t, pos, marker;
			this.scope[0].length = l;
			// iterate trough data
			for(i = 0; i<l;i++){
				if(data[i]!==null && typeof data[i] !== 'undefined'){
					this.scope.push(data[i]);
					this.scope[0].i = i;
					// iterate trough the markers of the current template
					for(m in tokens.marker){if(tokens.marker.hasOwnProperty(m)){
						d = this.scope.find(m);
//						t = typeof d;
						// iterate trough the positions the current marker should be inserted at
						for(pos in tokens.marker[m]){if(tokens.marker[m].hasOwnProperty(pos)){
							marker = tokens.marker[m][pos];
							d = marker.logic? marker.logic.apply({scope:this.scope, data:d, length:l, i:i}, marker.params) : d;
							t = typeof d;
							tokens[pos] = t === 'object'? this.render(d,marker.nested) : t==='function'? d.call(this,i,m) : d;
						}}
					}}
					res = res.concat(tokens);
					this.scope.pop();
				}
			}
			return res.join('');
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
				return [];
			}
			var last = this.tokenizer.detect.lastIndex = 0,
				count = 0,
				tokens = [],
				m,
				match;
			tokens.marker = {};
			while((match = this.tokenizer.detect.exec(template)) !== null){


				// found opening marker
				if(match[1]){
					// handle marker if all previous markers are closed
					if(count===0){
						m = this.tokenizer.getMarker(match); // marker itself
					}
					// remember: one more marker is opened
					count++;
				}

				// found closing marker TODO: check if the closing marker belongs to the opening marker
				if(match[match.length-1]){
					// if the number opened markers matches the number of closed markers
					if(count === 1){
						// nested templates are handled recursive. if the current marker has no nested template, '' is stored.
						m.nested = this.compile(template.slice(m.j,match.index));
						tokens.push(template.slice(last, m.i),'');
						// if no markers are detected until now, create an object for them
						if(!tokens.marker[m.id]){tokens.marker[m.id] = {};}
						// associate position & template with marker.
						tokens.marker[m.id][tokens.length-1] = m;
						// update the expression index for the next loop
						this.tokenizer.detect.lastIndex = last = match.index + match[0].length;
					}
					// remember one marker less is opened
					if(count>0){count--;}
				}
			}
			tokens.push(template.slice(last));
			return tokens.length? tokens : this.tokens;
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
		find: function(marker){
			for(var i = this.length-1; i+1; i--){
				if(typeof this[i][marker] !== 'undefined'){
					return this[i][marker];
				}
			}
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
				detect: /(\{\{|(?:^[ \t]*)?<!\-\-[ \t]*|\[|(?:^[ \t]*)?<!\-\-[ \t]*)(?:(\w+)(==|!=|<|>|<=|>=)(\w+)\?(\w+)(?:\:(\w+))?|(\w+))(?:[ \t]*\-\->(?:[ \t]*\n)?|\])?|(\}\}|(?:^[ \t]*)?<!\-\-[ \t]*\/\w+[ \t]*\-\->(?:[ \t]*\n)?|\[\/\w+\]|[ \t]*\-\->(?:[ \t]*\n)?)/gm,
				indices:{"0":0,"5":1,"opn":{},"lpn":{},"logic":[{"params":["comp1","rel","comp2","id","els"],"id":3,"start":2,"end":7,"check":5},{"params":[""],"id":0,"start":7,"end":8,"check":7}],"cls":{},"cmm":{},"pos":0,"id":[]}
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
				['%w', '\\w+'], // word
				['%s', '[ \\t]*'], // white space (no line breaks)
				['%ls', '(?:^[ \\t]*)?'], // line start
				['%le', '(?:[ \\t]*\\n)?'], // line end
				['%n', '\\n'], // line break
				['%comment','.*']
			],
			logic:[
				{exp: '(%w)(==|!=|<|>|<=|>=)(%w)\\?(%w)(?:\\:(%w))?', handler:function(comp1, rel, comp2, id, els){
					var v0 = this.scope.find(id) || id,
						v1 = this.scope.find(comp1) || comp1,
						v2 = this.scope.find(comp2) || comp2,
						v4 = this.scope.find(els) || els;
					switch(rel){
						case '==': return v1 == v2? v0 : v4;
						case '!=': return v1 != v2? v0 : v4;
						case '<': return v1 < v2? v0 : v4;
						case '>': return v1 > v2? v0 : v4;
						case '<=': return v1 <= v2? v0 : v4;
						case '>=': return v1 >= v2? v0 : v4;
						default: return '';
					}
				}},
				{exp: '(%w)', handler:false}
			]
		},

		/** @constructs */
		init: function(options){
			options = typeof options ==='object'? options : this.presets[options] || this.presets['html'];

			this.options = extend({},this.defaults,this.defaults[options.presets]||{},options,true);
			if(options.detect){
				this.detect = this.options.detect;
				this.indices = this.options.indices;
				return;
			}

			this.opener = [];
			this.closer = [];
			this.divider = [];
			this.selector = [];
			this.indices = {opn:{}, lpn:{}, logic:[], cls:{}, cmm:{}, pos:0, id:[]};
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
			this.detect = new RegExp(exp, 'gm');
		},

		analyse: function(){
			var pattern = this.options.pattern,
				logic = this.options.logic,
				single = new RegExp('^(.+)' + this.options.marker.logic + '()(.+)$'),
				nested = new RegExp('^(.+)' + this.options.marker.logic + '(?:(.*)' + this.options.marker.nested + ')(.+)$'),
				pos = 2,
				i, match, id, params;

			// split pattern into opener, divider & closer
			for(i = 0; i < pattern.length; i++){
				if((match = pattern[i].match(nested) || pattern[i].match(single)) && match[1] && match[3]){
					this.opener.push(this.esc(match[1]));
					this.closer.push(this.esc(match[3]));
					if(match[2]){
						this.divider.push(this.esc(match[2]));
					}
				}
			}

			// build the selector regexp part
			for(i=0; i< logic.length; i++){
				params = logic[i].params? logic[i].params : logic[i].handler.toString().substring(logic[i].handler.toString().indexOf('(')+1, logic[i].handler.toString().indexOf(')')).split(/\W+/);
				id = typeof logic[i].id == 'number'? logic[i].id : params.lastIndexOf('id')>-1? params.lastIndexOf('id') : 0;

				this.indices.logic[i] = {
					params: params,
					id:id,
					start: pos,
					end: pos + params.length,
					check: pos + id
				};
				pos += params.length;
				this.selector.push(logic[i].exp);
			}
		},
		/**
		 * prepare a match
		 * @param match
		 * @return {Object}
		 */
		getMarker: function(match){
			var m = match.slice(2,-1),
				logic = this.options.logic,
				indices = this.indices.logic,
				i;
			/*for(i=0; i<m.length; i++){
				if(typeof m[i] !== 'undefined'){
					l = logic[this.indices[i]];
					h = l.handler;
					p = m.slice(i, i + h.length);
					i = p[l.params.lastIndexOf('id')]||m[i];
					return {logic:h, params:p, id:i, i:match.index, j:match.index+match[0].length, opened:match[0]};
				}
			}*/
			for(i=0; i<logic.length; i++){
				if(typeof match[indices[i].check] !== 'undefined'){
					return {
						logic:logic[i].handler,
						params:match.slice(indices[i].start, indices[i].end),
						id:match[indices[i].check],
						i:match.index,
						j:match.index+match[0].length,
						opened:match[0]};
				}
			}
			return false;
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
})();