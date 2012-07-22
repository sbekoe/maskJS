/**
 * mask.js
 * @author Simon Bekoe
 * @version 0.1
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
	 * @property {Array} tmp The compiled template
	 * @property {String} template The template source
	 * @property {Object} options The options for this template. They extend the default options.
	 * @property {Pattern} pattern The pattern object initialized with options.pattern. pattern.exp contains the regExp to compile this template
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
		 *   - building the pattern expression to detect markers
		 *   - instantiating the data scope for rendering
		 *   - compiling or using cache
		 * @memberOf Mask#
		 * @constructs
		 * @this {Mask}
		 */
		init: function(){
			this.pattern =  new Pattern(toArray(this.options.pattern));
			this.scope = new Scope(defaults.marker,this.options.marker);
			this.tmp = this.options.cache && cache[this.template]? cache[this.template] : (cache[this.template] = this.compile(this.template));
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
			var tmp = arguments[1] || this.tmp,
				scope = this.scope,
				res = [],
				marker, i, m, t, p;
			// iterate trough data
			for(i = 0; i<data.length;i++){
				if(data[i]!==null && typeof data[i] !== 'undefined'){
					scope.push(data[i]);
					// iterate trough xxx
					for(m in tmp.marker){if(tmp.marker.hasOwnProperty(m)){
						marker = scope.find(m);
						t = typeof marker;
						// iterate trough xxx
						for(p in tmp.marker[m]){if(tmp.marker[m].hasOwnProperty(p)){
							tmp[p] = t === 'object'? this.render(marker,tmp.marker[m][p]) : t==='function'? marker(i,m) : marker;
						}}
					}}
					res = res.concat(tmp);
					scope.pop();
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
			var last = this.pattern.exp.lastIndex = 0,
				count = 0,
				tmp = [],
				match, id, pos;
			tmp.marker = {};
			while((match = this.pattern.exp.exec(template)) !== null){
				// found opening marker
				if(match[1]){
					// handle marker if all previous markers are closed
					if(count===0){
						tmp.push(template.slice(last,match.index),'');
						pos = match.index + match[0].length;
						id = match[2];
					}
					// remember: one more marker is opened
					count++;
				}

				// found closing marker TODO: check if the closing marker belongs to the opening marker
				if(match[3]){
					// if the number opened markers matches the number of closed markers
					if(count === 1){
						// if no markers are detected until now, create an object for them
						if(!tmp.marker[id]){tmp.marker[id] = {};}
						// associate position & template with marker. nested templates are handled recursive. if the current marker has no nested template, '' is stored.
						tmp.marker[id][tmp.length-1] = this.compile(template.slice(pos,match.index));
						// update the expression index for the next loop
						this.pattern.exp.lastIndex = last = match.index + match[0].length;
					}
					// remember one marker less is opened
					count--;
				}
			}
			tmp.push(template.slice(last));
			return tmp.length? tmp : this.tmp;
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
		find: function(marker){ for(var i = this.length-1; i+1; i--){
			if(typeof this[i][marker] !== 'undefined'){
				return this[i][marker];}} }
	};

	/**
	 * Create new Pattern
	 * Used to build the regexp to detect the markers of a template
	 * @constructor
	 */
	function Pattern(items){
		this.init(items);
	}

	Pattern.prototype = {
		wildcards: {
			id: ['%id', '(\\w+)'],	//Do not edit these wildcard. They are used internally.
			tmp: ['%tmp', ''],		// Do not edit these wildcard. They are used internally.
			s:['%s', '\\s*'],
			n: ['%n', '\\n']
		},
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
			var items = items || 'default';
			if(this.presets[items]){
				this.exp = this.presets[items].exp;
				this.items = this.presets[items].items;
				return;
			}
			this.items = items;

			//sub pattern
			this.opener = [];
			this.closer = [];
			this.divider = [];

			// regular expressions
			this.splitNestedPattern = new RegExp('^(.+)' + this.wildcards.id[0] + '(?:(.*)' + this.wildcards.tmp[0] + ')(.+)$');
			this.splitPattern = new RegExp('^(.+)' + this.wildcards.id[0] + '()(.+)$');

			this.analysePattern();
			this.build();
		},

		// concatenate the sub pattern to a regex & substitute wildcards
		build: function(){
			var exp = ('(' + this.opener.join('|') + ')(\\w+)(?:' + this.divider.join('|') + ')?|(' + this.closer.join('|') + ')'),
				w;
			for(w in this.wildcards){if(this.wildcards.hasOwnProperty(w)){
				exp = exp.replace(new RegExp(this.wildcards[w][0],'g'), this.wildcards[w][1]);
			}}
			this.exp = RegExp(exp, 'g');
		},

		// split pattern into opener, divider & closer
		analysePattern: function(){
			var match;
			for(var i = 0; i < this.items.length; i++){
				if((match = this.items[i].match(this.splitNestedPattern) || this.items[i].match(this.splitPattern)) && match[1] && match[3]){
					this.opener.push(this.esc(match[1]).replace(this.wildcards['%id'],''));
					this.closer.push(this.esc(match[3]));
					if(match[2]){
						this.divider.push(this.esc(match[2]));
					}
				}
			}
		},

		analyseWildcards:function(){
			// wildcards will be prepared here later to allow "logic pattern"
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

/* Example:
var tmp = Mask.t(
	'<!--defMarker/-->\n' +
	'<!--dynMarker/-->\n' +
	'<ul class="{{ top }}">\n' +
		'<!--item-->\n' +
		'\t<li class="{{itemClass}}">{{i}}: {{itemName}}</li> ' +
		'{{unusedMarkerWillDisappear}}' +
		'<!--/item-->\n' +
	'</ul>\n',
	{
		pattern:['{{%s%id%s}}','{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],
		cache:false,
		marker:{
			defMarker:"I'm not given in the data object!",
			dynMarker:function(){return "I'm rendered dynamically by a function!";}
		}
	}
);

console.log(tmp.render({
	listClass:'ul',
	itemClass:'li',
	item:[
		{itemName:'list element'},
		{itemClass:'li extra class', itemName:'another list element'}
	],
	unusedData:'???'
}));

//*/