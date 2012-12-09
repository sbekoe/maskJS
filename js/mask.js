/**
 * mask.js
 * @fileOverview fileDescription
 * @author Simon Bekoe
 * @version $Id$
 */

window.Mask = window.Mask ||  (function(window, document, undefined){
	"use strict";

	var
		/** @const */ NAMESPACE_DELIMITER = '.',
		/** @const */ NAMESPACE_DELIMITER_EXP = /\./g,
		/** @const */ NAMESPACE_HOLD = ':',
		/** @const */ PATH_ATTR = RegExp('(?:^|\\' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')(\\w+)$'),
		/** @const */ PATH_OBJ = RegExp('(\\w+)(?:$|' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')');

	/**
	 * Represents a Template
	 * @constructor
	 * @property {Array} tokens The compiled template
	 * @property {String} template The template source
	 * @property {Object} options The options for this template. They extend the default options.
	 * @property {Compiler} tokenizer The tokenizer object initialized with options.pattern. tokenizer.exp contains the regExp to compile this template
	 * @property {Scope} scope The Scope represents the data closure while rendering the template.
	 * @param {String} template
	 * @param {Object} options
	 */
	function Mask(template,options){
		var opt = typeof options ==='object'? options : presets[options] || presets['default'];
		this.template = template;
//		this.options = _extend({}, defaults, presets[opt.preset]||{}, opt, true);
		this.options = _.extend({}, defaults, presets[opt.preset]||{}, opt, true);
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
			this.tokenizer =  new Compiler(this); // rename to compiler
			//this.scope = new Scope({},this.options.data);
			//this.tokens = this.options.cache && cache[this.template]? cache[this.template] : (cache[this.template] = this.compile(this.template));

/*

            var
                template = {source:'...', conf:{}, strip:'', tokens:[], stream:'', code:''},
                parser = compiler.analyse(template), // extend conf and strip=screen(template)
                stream = compiler.synthesize(template, parser),
                code = compiler.generate(stream, tokens);
*/

		}

	};


    //*/
	/**
	 * Create new Compiler
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
	function Compiler(mask){
		this.mask = mask;

        this.analyse();
        this.synthesize(this.mask.template);
        this.generate();
	}

	Compiler.prototype = {
		analyse: function(){
			var
                pattern = this.mask.options.pattern,
				marker = this.mask.options.marker,
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
					if (part['$delimiterL'][0]) {
                        wildcards.delimiterL.push('(' + Exp.esc(part.$delimiterL[0],true) + ')>' + patternOrder[i])
					}
					if (part['$delimiterR'][0]) {
                        wildcards.delimiterR.push(Exp.esc(part['$delimiterR'][0],true));
                    }
					if (part['$closer'][0] || part['$delimiterR'][0]) {
                        wildcards.closer.push('(' + Exp.esc(part['$closer'][0]? part['$closer'][0].replace('%id','#id') : part['$delimiterR'][0], true) + (part['$closer_id'][0] ? ('|' + Exp.esc(part['$delimiterR'][0],true)) : '') + ')>' + patternOrder[i])
					}
				}
			}

			for(m in marker){if(marker.hasOwnProperty(m)){ markerOrder.push(m); }}
			markerOrder.sort(function(l1,l2){
				return marker[l2].priority - marker[l1].priority || marker[l2].exp.length - marker[l1].exp.length;
			});

			// build the selector regexp part
			for(i=0; i<markerOrder.length; i++){
				wildcards.logic.push(marker[markerOrder[i]].exp2 || marker[markerOrder[i]].exp);
			}

			this.exp = new Exp(exp,{
                wildcards:wildcards,
                assignments:pattern
            });
		},

		synthesize: function(template){
			var
				tokens,
				objects = [],
				text;

			// Lexical analysis (scanner)
			tokens = this.exp.scan(template, function(match, tokens){
				if(text = template.slice(match.lastRange[1], match.range[0])){
					tokens.push('text ' + (objects.push(text)-1));
				}
				return (match['$opener'][0]? 'opener ' : 'closer ') + (objects.push(match)-1) + (' ' + (match.name || '')) + (' ' + (match.$param.join(' ') || ''));
			});
			if(this.exp.lastMatch) tokens.push('text ' + (objects.push(template.slice(this.exp.lastMatch.range[1]))-1));
			this.stream = tokens.reverse().join('\n');
			this.objects = objects;
			return tokens;
		},

		generate: function(parent){
			var
				parent = parent || {},
				stream = parent.stream || this.stream,
				parentNamespace = parent.namespace || this.namespace || 'main',
				namespace, path,
				nextToken = /^(text|closer|opener) (\d+)(?: (\w+))?(?: (\w+))?.*$/gm,
				nextIndexedOpener,
				nextOpener,
				token, opener,
				tokens = [],
				references = [],
				nested,
                viewTemplate = View.template.toString(),
                view = viewTemplate.slice(viewTemplate.indexOf('{')+1, viewTemplate.lastIndexOf('}'));
				while(token = nextToken.exec(stream)){
					switch(token[1]){
						case 'text':
							tokens.push('"' + Generator.esc(this.objects[token[2]]) + '"');
							break;
						case 'closer':
							nextIndexedOpener = new RegExp('^(opener) (\\d+) (' + token[3] + ') .*('+ token[4] + ').*$','gm'); // insert pattern and id/closer id
							nextOpener = new RegExp('^(opener) (\\d+) (' + token[3] + ').*$','gm'); // insert pattern
							nextIndexedOpener.lastIndex = nextOpener.lastIndex = nextToken.lastIndex;
							if(opener = nextIndexedOpener.exec(stream) || nextOpener.exec(stream)){
								nested = stream.slice(nextToken.lastIndex, opener.index);
								namespace = (this.objects[opener[2]]['$namespace'][0]||'');
								path =  parentNamespace + NAMESPACE_DELIMITER + namespace;
								nextToken.lastIndex = opener.index + opener[0].length;
								references.push(namespace);
								tokens.push("$.handle('" + namespace + "', '" + path + "')");
								if(nested !== ''){
									this.generate({stream:nested, namespace:path});
								}
							}else{
								throw ('no opener found for the token: ' + token[0]);
							}
							break;
						case 'opener':
							references.push(namespace = (this.objects[token[2]]['$namespace'][0]||'').split(NAMESPACE_DELIMITER_EXP));
							tokens.push("$.handle('" + namespace + "')");
							break;
					}

				}
            var generator = {
                "TOKENS": tokens.reverse().join(" + "),
                "NAMESPACE": parentNamespace
            };
            appendScript(view.replace(/_([A-Z]+)_/g, function(marker, name){return generator[name] || marker ; }));
		}

	};

	var
		removeTemplate = Compiler.removeTemplate = function(namepsace){
			delete Mask.template[namepsace];
		};




	// API

	/**
	 * Shorthand for new Mask(template, options)
	 * @param {String} template
	 * @param {Object} options
	 * @returns {Mask}
	 */
	Mask.t = function(template,options){ return new Mask(template,options); };
	//Mask.configure = function(space,settings){extend(Mask[space],settings,true);};
	/** @deprecated */
    Mask.template = {};
    Mask.v = {};
	Mask.render = function(template, data, scope){
		return Renderer.run(data, template, scope);
	};


	var Renderer = Mask.Renderer = {
		run: function(data, template, parent){
			var tpl = Mask.template[template],
				meta = {i:0, n:0}, // metadata scope provides runtime data
				scope = Renderer.scope(meta, parent),
				output;
			if(tpl === undefined) return '';

			output = _(makeArray(data))
				.map(function(data, i, l){
					meta.i = i;
					meta.n = l.length;
					return tpl.render(data, scope);
				})
				.join('');

			delete meta.i, meta.n;

			return output;
		},

		handle: function(namespace, scope, template){
			var data = scope.data(namespace)
			switch(typeof data){
				case 'string':
				case 'number': return data;
				case 'object': return template? Renderer.run(data, template, scope) : '';
				default: return '';
			}
		},

		scope: function(data, parent){
			parent = parent || {data: new Function}; // create parent context if necessary
			return {
				data: function(namespace){ return lookup(namespace, data, parent.data);},
				parent: parent
			};
		}
	}

    var genTranslator = {}, genTemplate = {}; // Todo: Generator._Translator = {} ... ?
    var Generator = Mask.Generator = {

        // produces js string from a js template and and a context holding additional info
        render: function(template, context){
            var tpl = this._template[template],
                trl = this._translator,
                key, key2, result;
            context = context || {};
            error(!tpl && this.debug, '(generator) The template' + template + 'do not exist.');

            for(var i in tpl.key){
                key = tpl.key[i];
                key2 = key.toLowerCase();
                tpl.tokens[i] = trl[key] && (result = trl[key].call(this, context, key)) !== undefined? result :
                    trl[key2] && (result = trl[key2].call(this, context, key)) !== undefined? result :
                    context[key] || context[key2] || key;
            }

            //return genTemplate[template].replace(/_([A-Z]+)_/g, function(sub, key){return trl[key]? trl[key].call(this, key, context) : context[key] || sub ; });
            return tpl.tokens.join('');
        },

        addTemplate: function(key, template){
            var match, keys, tpl = {tokens:[], key:{}}, prevIndex = 0, offset;
            log(!!genTemplate[key], '(generator) Overwrite template "' + key + '"');
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

                    if((offset = this._offset.exec(template)[0]).length) template = template.replace(new RegExp('(^|\\n)' + this.esc(offset, true),'g'),'$1');
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

        addTranslator: function(key, fct){
            log(!!this._translator[key], '(generator) Overwrite translator "' + key + '"');
            this._translator[key] = fct;

            return this;
        },

        esc: function(str){
            return str
                .replace(/[\\]/g, '\\\\')
                .replace(/[\"]/g, '\\\"')
                .replace(/[\/]/g, '\\/')
                .replace(/[\b]/g, '\\b')
                .replace(/[\f]/g, '\\f')
                .replace(/[\n]/g, '\\n')
                .replace(/[\r]/g, '\\r')
                .replace(/[\t]/g, '\\t');
        },

        stringify: function(str){
            return '"' + this.esc(str) + '"';
        },

        _template: {},
        _translator: {},
        _offset: /^[\s\t]*/,
        _keyList: /\s*\/\*\*\s*@marker\s*\*\/\s*var\s*([^;]+)\s*;\n*/g
    };


    var View = Mask.View = function(options){
        this.data = {};
        this.meta = {}
        this.parent = {};
        this.nested = [];
        this.index = 0;

        this.getData = _.bind(this.getData,this);
        this._configure(options || {});
        this.initialize.apply(this, arguments);

        if(this.parent.nested !== undefined) this.index = this.parent.nested.push(this) - 1;

    };

    var viewOptions = ['data', 'meta', 'parent'];

    View.prototype = {
        initialize: function(){},

        nest: function(data, viewPath){
            var view = Mask.v[viewPath],
                meta = {i:0, n:0}; // metadata scope provides runtime data

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

    View.template = function(){
        /** @marker: */
        var NAMESPACE, CONTENT;

        Mask.v['_NAMESPACE_'] = Mask.View.extend({
            render:function (data) {
                var $ = this;
                if(data) $.data = data;

                return _TOKENS_;
            },
            initialize: function () {}
        });
    }






	var presets = Mask.presets = {},
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
                    //priority:0
                },
                "condition":{
                    exp: "(#param:%ns)(?:(#param:==|!=|<|>|<=|>=)(#param:%ns))?\\?(#param:#namespace)(?:\\:(#param:%ns))?"
                }
            },
			preset:'html', // TODO: change this to 'default' when this preset is created
			cache:true
		},

	    // Utilities
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
	return Mask;
}(window, document));
