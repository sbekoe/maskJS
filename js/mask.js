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
			'i': function(i,m){return i;}
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
		this.options = extend(defaults,options);
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
			this.tokenizer =  new Tokenizer(toArray(this.options.pattern));
			this.scope = new Scope(defaults.marker,this.options.marker);
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
				scope = this.scope,
				res = [],
				d, i, m, t, pos, marker;
			// iterate trough data
			for(i = 0; i<data.length;i++){
				if(data[i]!==null && typeof data[i] !== 'undefined'){
					this.scope.push(data[i]);
					// iterate trough the markers of the current template
					for(m in tokens.marker){if(tokens.marker.hasOwnProperty(m)){
						//d = this.scope.find(m);
						t = typeof d;
						// iterate trough the positions the current marker should be inserted at
						for(pos in tokens.marker[m]){if(tokens.marker[m].hasOwnProperty(pos)){
							marker = tokens.marker[m][pos];
							d = marker.logic.apply(this, marker.params);
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
				return '';
			}
			var last = this.tokenizer.detect.lastIndex = 0,
				count = 0,
				tokens = [],
				logic,
				match,
				logic,
				id, pos;
			tokens.marker = {};
			while((match = this.tokenizer.detect.exec(template)) !== null){


				// found opening marker
				if(match[1]){
					// handle marker if all previous markers are closed
					if(count===0){
						tokens.push(template.slice(last,match.index),'');
						pos = match.index + match[0].length;
						logic = this.tokenizer.getLogic(match);
						//id = match[2];
						id = logic.id;
					}
					// remember: one more marker is opened
					count++;
				}

				// found closing marker TODO: check if the closing marker belongs to the opening marker
				if(match[match.length-1]){
					// if the number opened markers matches the number of closed markers
					if(count === 1){
						// if no markers are detected until now, create an object for them
						if(!tokens.marker[id]){tokens.marker[id] = {};}
						// associate position & template with marker. nested templates are handled recursive. if the current marker has no nested template, '' is stored.
						tokens.marker[id][tokens.length-1] = {
							nested:this.compile(template.slice(pos,match.index)),
							logic: logic.handler,
							params: logic.params
						};
						// update the expression index for the next loop
						this.tokenizer.detect.lastIndex = last = match.index + match[0].length;
					}
					// remember one marker less is opened
					if(count>0){count--};
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
	 */
	function Tokenizer(items){
		this.init(items);
	}

	Tokenizer.prototype = {
		wildcards: [// rename to patternSubstitution
			['%w', '\\w+'], // word
			['%s', '[ \\t]*'], // white space (no line breaks)
			['%ls', '(?:^[ \\t]*)?'], // line start
			['%le', '(?:[ \\t]*\\n)?'], // line end
			['%n', '\\n'] // line break
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
			{exp: '(%w)', handler:function(id){ return this.scope.find(id); }}
			//{exp: , handler:},
		],
		presets: {
			default:{
				items:['{{%s%id%s}}','{{%s%id%s:%tmp%s}}'],
				exp: /(\{\{\s*|\{\{\s*)(\w+)(?:\s*:)?|(\s*\}\}|\s*\}\})/g
			},
			html:{
				items:['{{%s%id%s}}','{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],
				exp: /(\{\{\s*|\{\{\s*|<!\-\-\s*|<!\-\-\s*)(\w+)(?:\s*:|\s*\-\->)?|(\s*\}\}|\s*\}\}|\s*\/\-\->|<!\-\-\s*\/(\w+)\s*\-\->)/g
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

		/** @constructs */
		init: function(items){
			items = items || 'default';
			if(this.presets[items]){
				this.exp = this.presets[items].exp;
				this.items = this.presets[items].items;
				return;
			}
			this.items = items;

			this.opener = [];
			this.closer = [];
			this.divider = [];
			this.marker = {
				logic: '%logic',
				nested: '%tmp'
			};
			// regular expressions
			this.splitNestedPattern = new RegExp('^(.+)' + this.marker.logic + '(?:(.*)' + this.marker.nested + ')(.+)$');

			this.splitPattern = new RegExp('^(.+)' + this.marker.logic + '()(.+)$');

			this.analyseSubstitutions();
			this.analysePattern();
			this.build();
		},

		// concatenate the sub pattern to a regex & substitute wildcards
		build: function(){
			var exp = ('(' + this.opener.join('|') + ')(?:' + this.logic.exp + ')(?:' + this.divider.join('|') + ')?|(' + this.closer.join('|') + ')'),
				i;
			for(i=0;i<this.wildcards.length;i++){
				exp = exp.replace(new RegExp(this.wildcards[i][0],'g'), this.wildcards[i][1]);
			}
			this.detect = RegExp(exp, 'gm');
		},

		// split pattern into opener, divider & closer
		analysePattern: function(){
			var match;
			for(var i = 0; i < this.items.length; i++){
				if((match = this.items[i].match(this.splitNestedPattern) || this.items[i].match(this.splitPattern)) && match[1] && match[3]){
					this.opener.push(this.esc(match[1]));
					this.closer.push(this.esc(match[3]));
					if(match[2]){
						this.divider.push(this.esc(match[2]));
					}
				}
			}
		},

		analyseSubstitutions:function(){
			var i, pos = 0, f, list = [];
			this.logic.pos = {};

			for(i=0; i< this.logic.length; i++){
				this.logic.pos[pos] = i;
				list.push(this.logic[i].exp);
				pos += this.logic[i].handler.length;
				f = this.logic[i].handler.toString();
				this.logic[i].params = f.substring(f.indexOf('(')+1, f.indexOf(')')).split(/\W+/);
			}
			this.logic.exp = list.join('|');
		},
		/**
		 * prepare a match
		 * @param match
		 * @return {Object}
		 */
		getLogic: function(match){
			var m = match.slice(2,-1),
				l, h, p, i;
			for(var i=0; i<m.length; i++){
				if(typeof m[i] !== 'undefined'){
					l = this.logic[this.logic.pos[i]];
					h = l.handler;
					p = m.slice(i, i + h.length);
					i = p[l.params.lastIndexOf('id')];
					return {handler:h, params:p, id:i};
				}
			}
		},

		// escape regexp chars //TODO: test if the escaping of  "-" is correct
		esc: function (str) {
			return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
		}
	}

	/**
	 * Shorthand for new Mask(template, options)
	 * @param {String} template
	 * @param {Object} options
	 * @returns {Mask}
	 */
	Mask.t = function(template,options){ return new Mask(template,options); };

	var cache = Mask.cache = {};
	var isArray = Mask.isArray =  Array.isArray || function(a) { return Object.prototype.toString.call(a) === '[object Array]'; };
	var toArray = function(x){return isArray(x)? x : [x];};
	var extend = Mask.extend = function(obj){function F(){} F.prototype = obj; var o = new F(); for(var i = 1; i<arguments.length; i++){ for(var a in arguments[i]){if(arguments[i].hasOwnProperty(a)){ o[a] = arguments[i][a];}}} return o;};
	return Mask;
})();