/**
 * mask.js
 * @fileOverview fileDescription
 * @author Simon Bekoe
 * @version $Id$
 */

window.Mask = window.Mask ||  (function(window, document, undefined){
	"use strict";

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
		var opt = typeof options ==='object'? options : presets[options] || presets['default'];
		this.template = template;
		this.options = extend({}, defaults, presets[opt.preset]||{}, opt, true);
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
			this.tokenizer =  new Tokenizer(this);
			this.scope = new Scope({},this.options.data);
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
				result = [],							// array of strings
				length = data.length,
				marker, pos, d, i, m, that = this;
			this.scope[0].length = length;
			// iterate trough data
			for(i = 0; i<length; i++){
				if(data[i]!==null && typeof data[i] !== 'undefined'){
					this.scope.push(data[i]);
					this.scope[0].i = i;
					// iterate trough the markers of the current template
					for(m in tokens.marker){if(tokens.marker.hasOwnProperty(m)){
						// get the default data associated with the name m
						d = this.scope.find(m);
						// iterate trough the positions the current marker should be inserted at
						for(pos in tokens.marker[m]){if(tokens.marker[m].hasOwnProperty(pos)){
							marker = Mask.marker(function(){this.mask = that;}, this.options.marker[tokens.marker[m][pos].name], tokens.marker[m][pos]);
							d = marker.handle(d);
							switch(typeof d){
								case 'string':
								case 'number': tokens.template[pos] = d; break;
								case 'object': tokens.template[pos] = marker.render(d); break;
								case 'function': tokens.template[pos] = d.call(this, marker); break;
								default: tokens.template[pos] = '';
							}
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
		 */
 		compile: function(template){
			template = typeof template ==='string'? template : this.template;
			if(!template){
				return {};
			}
			var t = this.tokenizer,
				tokens = {template:[], marker:{}, partial:{}},
				scope = {count:0, last:0,  m:{}, p:new RegExp(t.parser,'gm'), m2:[],i:0, c:0},
				m;
			while(m = this.tokenizer.parse(template, scope)){
				if(m.closed === true){
					m.nested = m.compile();

					tokens.template.push(template.slice(scope.last, m.outer[0]),'');
					// if no markers are detected until now, create an object for them
					tokens.marker[m.id] = tokens.marker[m.id] || {};
					// associate position & template with marker.
					tokens.marker[m.id][tokens.template.length-1] = m.get();
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
		var i;
		for(i=0; i<arguments.length; i++){
			this.push(arguments[i]);
		}
	}

	Scope.prototype = {
		length:0,
		push: Array.prototype.push,
		pop: Array.prototype.pop,
		find: function(namespace){
			var i, ns;
			if(typeof namespace === 'string' && namespace.length){
				for(i = this.length - 1, ns = namespace.split(/\W+/); i+1; i--){
					if(typeof this[i][ns[0]] !== 'undefined'){
						return ns.length === 1? this[i][ns[0]] : this.resolveNamespace(ns, this[i]);
					}
				}
			}
		},
		resolveNamespace: function(ns,root){
			var i, o;
			for(i= 0, o = root; i<ns.length; i++){
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
	 * @param {Mask} mask
	 * @property {Mask} mask
	 * @property {Array} opener
	 * @property {Array} divider
	 * @property {Array} closer
	 * @property {Array} logic
	 * @property {Object} captures
	 * @property {String} parser
	 */
	function Tokenizer(mask){
		this.mask = mask;

		if(mask.options.parser && mask.options.captures){
			this.parser = mask.options.parser;
			this.captures = mask.options.captures; // rename to captures
			return;
		}

		this.opener = [];
		this.divider = [];
		this.closer = [];
		this.logic = [];
		this.captures = {opener:1, closer:0, pattern:{}, marker:{}, id:0, i:2, length:0};
		this.parser = this.build();
	}

	Tokenizer.prototype = {
		// concatenate the sub pattern to a regex & substitute wildcards
		build: function(){
			this.analyse();
			return this.resolveWildcards(
				'(' + this.opener.join('|') + ')(?:' + this.logic.join('|') + ')(' + this.divider.concat(this.closer).join('|').replace(/%id/g,'%ns') + ')?|(' + this.closer.join('|') + ')'
			);
		},

		analyse: function(){
			var pattern = this.mask.options.pattern,
				marker = this.mask.options.marker,
				captures = this.captures,
				single = new RegExp('^(.+)' + '%logic' + '()(.*)$'),
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
				index = 2, // The position of the current capture. Starting at 2: 0 for the whole expression 1 for the opener
				markerOrder = [], patternOrder = [], match,  opener, closer, params, i, p, m, t;
			var exp = /#opener|#closer/gm,
//				wildcards = extend({}, this.mask.options.wildcards, {opener:'#delimiterL#logic#delimiterR', closer:[], delimiterL:[], delimiterR:[], logic:[], id:'#ns'}),
				wildcards = extend(
					{"id":"ns","ns":"%w(?:\\.%w)*","ls":"(?:^[ \\t]*)?","le":"(?:[ \\t]*\\n)?","n":"\\n","s":"[ \\t]*","w":"\\w+"},
					{opener:'#delimiterL#logic#delimiterR', closer:[], delimiterL:[], delimiterR:[], logic:[]}
				),
				part,id;

			// sort patterns
			for(m in pattern){if(pattern.hasOwnProperty(m)){ patternOrder.push(m); }}
			patternOrder.sort(function(m1,m2){
				return (pattern[m2].priority||0) - (pattern[m1].priority||0) || pattern[m2].token.length - pattern[m1].token.length;
			});
			// split token into opener, divider & closer
			for(i=0; i<patternOrder.length; i++){
				p = pattern[patternOrder[i]];
				// new
				if (p.token && (part = parts.exec(p.token))) {
					if (part['$delimiterL'][0]) { wildcards.delimiterL.push(Exp.esc(part.$delimiterL[0],true)); }
					if (part['$delimiterR'][0]) { wildcards.delimiterR.push(Exp.esc(part['$delimiterR'][0],true)); }
					if (part['$closer'][0] || part['$delimiterR'][0]) {
						wildcards[id = _.uniqueId(patternOrder[i])] = {
							source:Exp.esc(part['$closer'][0]? part['$closer'][0].replace('%id','#id') : part['$delimiterR'][0], true) + (part['$closer_id'][0] ? ('|' + Exp.esc(part['$delimiterR'][0],true)) : ''),
							assign:{pattern:patternOrder[i]}
						};
						wildcards.closer.push('#' + id);
					}
				}

				// old
				if(p.token && (match = p.token.match(nested) || p.token.match(single)) && match[1] ){
					opener = '(' + this.esc(match[1]) + ')';
					closer = this.esc(match[3]);
					t = p.type || (!match[2]? 'single' : match[4]? 'auto' : 'nested');
					captures.pattern[patternOrder[i]] = {
						index:index,
						type: t,
						hasCloser: (match[2] || match[3])? true : false
					};
					index++;
					this.opener.push(opener);
					if(!match[3]){break;}
					if(match[2]){
						this.divider.push(this.esc(match[2]));
						closer += t === 'nested'? '' : '|' + this.esc(match[2]);
					}

					this.closer.push(closer);
//					if(match[4]){ pos++; }
				}
			}
//			console.log(wildcards);

			for(m in marker){if(marker.hasOwnProperty(m)){ markerOrder.push(m); }}
			markerOrder.sort(function(l1,l2){
				return marker[l2].priority - marker[l1].priority || marker[l2].exp.length - marker[l1].exp.length;
			});
			// build the selector regexp part
			for(i=0; i<markerOrder.length; i++){
				m = marker[markerOrder[i]];
				params = m.params? m.params : ['nameSpace'];
				this.captures.marker[markerOrder[i]] = {
					params: params,
					index: [index, index + params.length],
					start: index,
					end: index + params.length
				};
				index += params.length;
				this.logic.push(m.exp);
				wildcards.logic.push(m.exp);
			}
			// save the match index of the closer
			this.captures.singleCloser = index;
			index ++;
			// save the match index of the closer
			this.captures.closer = index;
			index ++;
			// save the first match index of closing id's
			this.captures.id = index;
			this.captures.length = index + 1;
			this.exp = new Exp(exp,{wildcards:wildcards});
			//console.log(exp, parts,wildcards, this.exp);
		},

		parse2: function(template){
			var parser = new RegExp(this.parser,'gm'),
				tokens2,
				tokens = [], // the lexical tokens stream
				tree = {}, // the parse tree,
				objects = [],
				objects2 = [],
				match,
				i = 0, o, level;
			if(this.exp) console.log(this.exp, tokens2 = this.exp.scan(template, function(match, tokens){
				//tokens.push(template)
				return (match['$opener'][0]? 'opener ' : 'closer ') + (objects2.push(match)-1) + ((' ' + match.pattern)||'');
			}), objects2);
			// Lexical analysis (scanner)
			while(match = parser.exec(template)){
				tokens.push('text ' + (objects.push(template.slice(i,match.index))-1)); // add prepended text
				if(match[this.captures.opener]){
					o = this.getMarker(match);
					tokens.push('opener ' + (objects.push(o)-1) + ' ' + o.type + ' ' + o.params.join(' ')); // add opener: "[token type] [object index] [type] [param1] [...] [paramN] "
				}else if(match[this.captures.closer]){
					o = {match:match, id: match.slice(this.captures.id).join('')};
					tokens.push('closer '+ (objects.push(o)-1)); // add closer: "[token type] [object index]"
				}
				i = match.index + match[0].length;
			}


			return tokens.reverse().join('\\n');
			tree.template = [];
			tree.marker = {};
			// semantic analyses
		},

		parse:function(template, scope){
			this.parse2(template);
			var match, m = scope.m, id, m2 = scope.m2[scope.i];
			if((match = scope.p.exec(template)) !== null || scope.count){
				// found opening marker
				if(match && match[this.captures.opener]){
					// get marker instance if there are no previous unclosed markers
					m2 = this.getMarker(match);
					scope.p.lastIndex = m2.outer[1];
					if(m2.type === 'nested') scope.m2.push(m2);
					//m2 = this.getMarker(match);
					if(scope.c === 0){
						m = scope.m = this.getMarker(match); // marker itself
						if(m.open(match)){scope.count++; scope.c++;} // check if the match describes a valid opener. m.status should be 'opened' in this case
						scope.i = scope.m2.length-1;
					}else{
						// remember: one more marker is opened
						//if(m.type === 'auto'){scope.count++};
						if(m2.type === 'nested'){scope.c++}
					}

				}

				// found closing marker
				else if(m.status === 'opened' && match && match[this.captures.closer]){
					// get the closing id if it's available
					id = match.slice(this.captures.id).join('');
					// check if the number of opened markers matches the number of closed markers or check  an available closing id against the opening id
					if((!id && scope.c === 1) || (id &&  m.params.indexOf(id)>-1)){
						m.close(match, id, template);
					}
					// remember one marker less is opened
//					if(scope.count>0){scope.count--;}
					if(scope.c>0){scope.c--;}
				}

				// if marker was closed or no closer was found
				if(m.status === 'closed' || !match){
					m.done();
					scope.count = 0;
					scope.c = 0;
					// update the expression index for the next loop
					scope.last = scope.next;
					scope.p.lastIndex = scope.next = match? m.outer[1] : m.inner[0];
				}else{
					m.closed = false;
				}
//				scope.p.lastIndex = scope.next = match? m.outer[1] : m.inner[0];
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
			var marker = this.mask.options.marker,
				indices = this.captures.marker,
				m, p;

			for(m in marker){if(marker.hasOwnProperty(m)){
				if((p = match.slice(indices[m].index[0], indices[m].index[1])).join('')){
					return Mask.marker(this.getMarkerConstructor(match, m, p),marker[m]);
				}
			}}
			return null;
		},
		getMarkerConstructor:function(match,m,p){
			var that = this,
				position = match.index,
				pattern = this.getPattern(match),
				enabledMarkers = this.mask.options.pattern[pattern].marker || '',
				capture = this.captures.pattern[pattern],
				closer = match[this.captures.singleCloser],
				opener = capture.hasCloser === false && closer? match[0].replace(closer,'') : match[0],
				type =  enabledMarkers && enabledMarkers.split(/[ ,]/).indexOf(m) === -1? 'undefined' : this.mask.options.pattern[pattern].type || (capture.hasCloser === true && !closer? 'comment' : capture.type);
			return function(){
				this.mask = that.mask;
				this.name = m; // index of the logic selector
				this.params = p;
				this.id = p[0]; // use the first param of the selector as default
				this.start = position;
				this.end = position + opener.length;
				this.inner = [position + opener.length];
				this.outer = [position,position + opener.length];
				this.opener = opener;
				this.nested = [];
				this.status = 'created';
				this.closed = false;
				this.pattern = pattern;
				this.type = type;
			}
		},
		getPattern: function(match){
			var p = this.captures.pattern, n;
			for(n in p){if(p.hasOwnProperty(n) && match[p[n].index]){return n;}}
		},


		// escape regexp chars //TODO: test if the escaping of  "-" is correct
		esc: function (str) {
			return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
		},

		resolveWildcards: function(source,wildcards) {
			var i, s, wc = wildcards || this.mask.options.wildcards;
			while(source !== s){
				s = source;
				for(i=0;i<wc.length;i++){
					source = source.replace(new RegExp(wc[i][0],'g'), wc[i][1]);
				}
			}
			return source;
		}
	};

	function Marker(mask){
		this.init(mask);
	}
	Marker.prototype = {
		// initialize
		init: function(mask){
			this.mask = mask;
			return this;
		},

		// methods called from the compiler
		compile: function(template){
			return this.isNested? this.mask.compile(template || this.template) : [];
		},
		open: function(){
			var pattern = this.mask.options.pattern[this.pattern];
			this.type = pattern.marker && pattern.marker.split(/[ ,]/).indexOf(this.name) === -1? 'undefined' : this.type;
			this.status = this.type === 'single'? 'closed' : 'opened';
			return this.type === 'undefined'? false : true; // return true increases the number of opened markers
//			return pattern.marker? pattern.marker.split(/[ ,]/).indexOf(this.name)>-1 : true; // return true increases the number of opened markers
		},
		close: function(match, closingId, template){
			this.id = closingId || this.id;
			this.isNested = true;
			this.closer = match[0];
			this.inner[1] = match.index;
			this.outer[1] = match.index + match[0].length;
			this.template = template.slice(this.inner[0], this.inner[1]);
			this.status = 'closed';
			return true;
		},
		done: function(){
			this.closed = true;
			this.status = 'done';
			return true;
		},

		get: function(){
			return {name:this.name, nested:this.nested, params:this.params};
		},

		// methods called from the rendering engine
		handle: function(defaultData){
			return defaultData;
		},
		render: function(data){
			return this.mask.render(data,this.nested);
		},

		_core: function(handler){
			return Marker.prototype[handler].apply(this, Array.prototype.slice.call(arguments, 1));
		},
		priority: 0,
		exp: '(%ns)'
	};

	// API

	/**
	 * Shorthand for new Mask(template, options)
	 * @param {String} template
	 * @param {Object} options
	 * @returns {Mask}
	 */
	Mask.t = function(template,options){ return new Mask(template,options); };
	Mask.createMarker = Mask.marker = function(Constructor,prototype,attributes){
		Constructor.prototype = prototype || new Marker();
		return extend(new Constructor(),attributes||{});
	};
	Mask.configure = function(space,settings){extend(Mask[space],settings,true);};

	var presets = Mask.presets = {},
		defaults = Mask.defaults = {			// default options
			data:{},
			pattern:{
				mustache:{ token:'{{%logic}}' }
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
			marker:{
				/* possible attributes, methods are optional
				 "markerName": Mask.marker(function(){
					 this.exp = '';
					 this.handle = function(){ return {};};
					 this.render = function(data, tokens){ return '';}, // context: Mask template
					 this.compile = function(marker, tokens, scope, template){ return {};}; // context: Mask template
					 this.open = function(){return true};
					 this.close = function(){return true};
				 })
				 // */
			},
			preset:'html', // TODO: change this to 'default' when this preset is created
			cache:true
		},

	// Utilities
		cache = Mask.cache = {},
		isArray = Mask.isArray =  Array.isArray || function(a) { return Object.prototype.toString.call(a) === '[object Array]';},
		extend = Mask.extend = function(o){
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
							o[a] = extend({},o[a],options[i][a],true); // sub object will always be cloned
						}else{
							o[a] = options[i][a];
						}
					}
				}
			}
			return o;
		};
	return Mask;
}(window, document));

// expJS - https://gist.github.com/3726969
//var Exp=function(){function g(a,b){b=b||a||{};this.source=a.source||a;this.global=a.global||b.global;this.ignoreCase=a.ignoreCase||b.ignoreCase;this.multiline=a.multiline||b.multiline;this.flags=b.flags||"";this.wildcards=b.wildcards||{};this.defaultMatch=b.defaultMatch||null;this.lastIndex=b.lastIndex||0;this.lastRange=[0,0];this.compile(b)}g.prototype={compile:function(a){var b=[],c=[],f=[],h=["#","%"],g=this.wildcards,a=a||{},d;for(d in g)g.hasOwnProperty(d)&&("#"===d[0]&&(d=d.slice(1),f.push(d), h.push(d)),"%"===d[0]&&(d=d.slice(1),c.push(d),h.push(d)),b.push(d));this._captures=a.captures||["$"];this._escaped=h;this._needle=RegExp("\\\\("+h.join("|")+")|(#|%)("+b.join("|")+")|("+(f.join("|")||"$^")+")|("+(c.join("|")||"$^")+")","g");this._exp=RegExp(1<this._captures.length?this.source:this.build(this.source,this._captures),this.flags||(this.global?"g":"")+(this.ignoreCase?"i":"")+(this.multiline?"m":""))},build:function(a,b,c){for(var f=this.wildcards,h=this._needle,g=this._escaped,c=c|| [],d=[],k=h.lastIndex=0,j,l,e,i;e=h.exec(a);)if(i=f[e[3]]||f["#"+e[4]]||f["%"+e[5]])l="#"===e[2]||"undefined"!==typeof e[4],j=e[3]||e[4]||e[5],-1===c.indexOf(j)?c.push(j):this.error('"'+j+'" includes itself. This would end up in infinity recursion loop!'),l&&b.push("$"+c.join("_")),i=(l?"(":"(?:")+this.build(i.source||(i.join?i.join("|"):i),b,c)+")",d.push(a.slice(k,e.index),i),h.lastIndex=k=e.index+e[0].length,c.pop();d.push(a.slice(k));return d.join("").replace(RegExp("\\\\("+g.join("|")+")","g"), "$1")},exec:function(a){var b,c=this._captures;this._exp.lastIndex=this.lastIndex;if(a=this._exp.exec(a)){this.lastIndex=this._exp.lastIndex;a.lastRange=this.lastRange;a.range=this.lastRange=[a.index,this._exp.lastIndex];for(b=0;b<c.length;b++)switch(typeof a[c[b]]){case "string":a[c[b]]=[a[c[b]],a[b]];break;case "object":a[c[b]].push(a[b]);break;default:a[c[b]]=a[b]}}return a||this.defaultMatch},test:function(a){return this._exp.test(a)},scan:function(a,b){var c=[],f;this.lastIndex=0;if(this.global)for(;f= this.exec(a);)c.push(b ? b.call(this, f) : f); return c }, expand:function (a) { return this.build(a, []) }, error:function (a) { throw"Error in Expression /"+this.source+"/: "+a;}};g.esc=function(a){return a.replace(RegExp("[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|%#]","g"),"\\$&")};g.version="0.4";return g}();

Mask.configure('defaults',{
	marker:{
		"default": Mask.marker(function(mask){
			this.mask = mask;
		}),
		"condition": Mask.marker(function(mask){
			this.mask = mask;
			this.exp = '(%ns)(?:(==|!=|<|>|<=|>=)(%ns))?\\?(%ns)(?:\\:(%ns))?';
			this.params = ['comp1','rel','comp2','data','alt'];
			this.handle = function(){
				var check = this.mask.scope.find(this.params[0]),
					comp1 = check || this.params[0],
					comp2 = this.mask.scope.find(this.params[2]) || this.params[2],
					data = this.mask.scope.find(this.params[3]),
					alt = this.mask.scope.find(this.params[4]) || this.params[4];
				switch(this.params[1]){
					case '==': return comp1 == comp2? data : alt;
					case '!=': return comp1 != comp2? data : alt;
					case '<': return comp1 < comp2? data : alt;
					case '>': return comp1 > comp2? data : alt;
					case '<=': return comp1 <= comp2? data : alt;
					case '>=': return comp1 >= comp2? data : alt;
					default: return check? data : alt;
				}
			};
		})
	}
});

Mask.configure('presets',{
	"default":{},
	"html":{
		parser: "(((?:^[ \\t]*)?<!\\-\\-[ \\t]*)|(\\{\\{))(?:(\\w+(?:\\.\\w+)*)(?:(==|!=|<|>|<=|>=)(\\w+(?:\\.\\w+)*))?\\?(\\w+(?:\\.\\w+)*)(?:\\:(\\w+(?:\\.\\w+)*))?|(\\w+(?:\\.\\w+)*))([ \\t]*\\-\\->(?:[ \\t]*\\n)?|(?:^[ \\t]*)?<!\\-\\-[ \\t]*\\/\\w+[ \\t]*\\-\\->(?:[ \\t]*\\n)?|\\}\\})?|((?:^[ \\t]*)?<!\\-\\-[ \\t]*\\/\\w+[ \\t]*\\-\\->(?:[ \\t]*\\n)?|\\}\\})",
		captures: {"opener":1,"closer":11,"pattern":{"html":{"index":2,"type":"nested","hasCloser":true},"mustache":{"index":3,"type":"single","hasCloser":true}},"marker":{"condition":{"params":["comp1","rel","comp2","data","alt"],"index":[4,9],"start":4,"end":9},"default":{"params":["nameSpace"],"index":[9,10],"start":9,"end":10}},"id":12,"i":2,"length":13,"singleCloser":10},
		pattern:{
			"mustache": {}, // the tokens do not have to defined in the presets pattern
			"html": {}
		}
	},
	"js":{

	},
	"css":{

	},
	"mustache":{

	}
});