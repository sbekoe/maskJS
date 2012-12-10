/**
 * mask.js
 * @fileOverview fileDescription
 * @author Simon Bekoe
 * @version $Id$
 */
(function(window, document, undefined){
	//"use strict";

	var
		/** @const */ NAMESPACE_DELIMITER = '.',
		/** @const */ NAMESPACE_DELIMITER_EXP = /\./g,
		/** @const */ NAMESPACE_HOLD = ':',
		/** @const */ PATH_ATTR = RegExp('(?:^|\\' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')(\\w+)$'),
		/** @const */ PATH_OBJ = RegExp('(\\w+)(?:$|' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')');

    var root = this,
        prevMask = this.Mask;
    /*
    var _ = root._;
    if (!_ && (typeof require !== 'undefined')) _ = require('underscore');

    var Exp = root.Exp;
    if (!Exp && (typeof require !== 'undefined')) Exp = require('underscore');

    */


    // Multi-pass compiler
	var Compiler =  {
        compile: function(source, options){
            // enable use by prototype extension and standalone
            this.source = source || this.source || '';
            this.options = options || this.options || {};

            this.lexer = this.define(); // define() is kind of a scanner generator lexer = scanner
            this.tokens = this.scan(); // lexical analyse // produces the stream also
            this.abstract = this.parse(); // syntactic analyse. build abstract syntax tree

            return this.abstract;
        },

		define: function(){
			var
                pattern = this.options.pattern,
				marker = this.options.marker,
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

			for(m in marker){if(marker.hasOwnProperty(m)){ markerOrder.push(m); marker[m].marker = m;}}
			markerOrder.sort(function(l1,l2){
				return marker[l2].priority - marker[l1].priority || marker[l2].exp.length - marker[l1].exp.length;
			});

			// build the selector regexp part
			for(i=0; i<markerOrder.length; i++){
				wildcards.logic.push('('+marker[markerOrder[i]].exp+')>'+markerOrder[i]);
			}

			return new Exp(exp,{
                wildcards:wildcards,
                assignments:_.extend({},pattern,marker)
            });
		},

		scan: function(source){
			var
                src = source || this.source,
                tokens = [],
                stream,
                text;

			// Lexical analysis (scanner)
			stream = this.lexer.scan(src, function(match, stream){
				if(text = src.slice(match.lastRange[1], match.range[0])){
					stream.push('text ' + (tokens.push(text)-1));
				}
				return (match['$opener'][0]? 'opener ' : 'closer ') + (tokens.push(match)-1) + (' ' + (match.name || '')) + (' ' + (match.$param.join(' ') || ''));
			});
			if(this.lexer.lastMatch) stream.push('text ' + (tokens.push(src.slice(this.lexer.lastMatch.range[1]))-1));

            this.stream = stream.reverse().join('\n');

            return tokens;
		},

		parse: function(s,a){
			var
				abstract = a || {namespace: this.namespace || 'root', content:[[]], token:[[]]},
                stream = s || this.stream,
				namespace, path, child,
				nextToken = /^(text|closer|opener) (\d+)(?: (\w+))?(?: (\w+))?.*$/gm,
				nextIndexedOpener,
				nextOpener,
				hash, // hash of a token
                ohash, // hash of an opener token
				tokens = [],
				nested,
                viewTemplate = View.template.toString(),
                view = viewTemplate.slice(viewTemplate.indexOf('{')+1, viewTemplate.lastIndexOf('}'));

				while(hash = nextToken.exec(stream)){
                    child = {namespace:'', content:[], token: [this.tokens[hash[2]]]};

					switch(hash[1]){
						case 'text':
							tokens.push('"' + Generator.esc(this.tokens[hash[2]]) + '"');
                            child = this.tokens[hash[2]];
							break;
                        case 'closer':
                            //TODO: nextToken.mode('indexedOpener opener').update({wildcards:{type:hash[3], param:hash[4]})
							nextIndexedOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ') .*('+ hash[4] + ').*$','gm'); // insert pattern and id/closer id
							nextOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ').*$','gm'); // insert pattern
							nextIndexedOpener.lastIndex = nextOpener.lastIndex = nextToken.lastIndex;

							ohash = nextIndexedOpener.exec(stream) ||
                                    nextOpener.exec(stream) ||
                                    error(true, '(Compiler) No opener found for the token: ' + hash[0]);

                            child.token.splice(0, 0, this.tokens[ohash[2]]);

                            nested = stream.slice(nextToken.lastIndex, ohash.index);
                            namespace = (this.tokens[ohash[2]]['$namespace'][0]||'');
                            child.namespace = path =  abstract.namespace + NAMESPACE_DELIMITER + namespace;
                            nextToken.lastIndex = ohash.index + ohash[0].length;
                            tokens.push("$.handle('" + namespace + "', '" + path + "')");
                            if(nested !== ''){
                                child.content.splice(0, 0, []);
                                this.parse(nested, child);
                            }

							break;
						case 'opener':
							namespace = (this.tokens[hash[2]]['$namespace'][0]||'').split(NAMESPACE_DELIMITER_EXP);
							tokens.push("$.handle('" + namespace + "')");

							break;
					}

                    abstract.content[0].push(child);

				}
            var generator = {
                "TOKENS": tokens.reverse().join(" + "),
                "NAMESPACE": abstract.namespace
            };
            appendScript(view.replace(/_([A-Z]+)_/g, function(marker, name){return generator[name] || marker ; }));
            _.invoke(abstract.content,'reverse');

            return abstract;
		}

	};



    var Generator = {

        // produces js string from a js template and and a context holding additional info
        generate: function(template, asbstract){
            var tpl = this._template[template || this.option.template],
                trl = this._translator,
                key, key2, result;
            asbstract = asbstract || this.asbtract || {};
            error(!tpl && this.debug, '(generator) The template' + template + 'do not exist.');

            for(var i in tpl.key){
                key = tpl.key[i];
                key2 = key.toLowerCase();
                tpl.tokens[i] = trl[key] && (result = trl[key].call(this, asbstract, key)) !== undefined? result :
                    trl[key2] && (result = trl[key2].call(this, asbstract, key)) !== undefined? result :
                    asbstract[key] || asbstract[key2] || key;
            }

            //return genTemplate[template].replace(/_([A-Z]+)_/g, function(sub, key){return trl[key]? trl[key].call(this, key, context) : context[key] || sub ; });
            return tpl.tokens.join('');
        },

        addTemplate: function(template, key){
            var match, keys, tpl = {tokens:[], key:{}}, prevIndex = 0, offset;
            this._template || (this._template = {});

            log(!!this._template[key], '(generator) Overwrite template "' + key + '"');

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

                    if((offset = this._offset.exec(template)[0]).length)
                        template = template.replace(new RegExp('(^|\\n)' + Generator.esc(offset, true),'g'),'$1');
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

        addTranslator: function(fct, key){
            log(!!this._translator[key], '(generator) Overwrite translator "' + key + '"');
            this._translator[key] = fct;

            return this;
        },

        _template: {},
        _translator: {},
        _offset: /^[\s\t]*/,
        _keyList: /\s*\/\*\*\s*@marker\s*\*\/\s*var\s*([^;]+)\s*;\n*/g
    };

    _.extend(Generator,{
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
        }
    });




    /**
     * class View
     * @constructor
     */
    var View = function(options){
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

    /**  @constructs  View  */
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

    var Mask  = function (template, options) {
        var opt = typeof options ==='object'? options : presets[options] || presets['default'];
        this.source = template;
        this.options = _.extend({}, defaults, presets[opt.preset]||{}, opt, true);

        this.init();
    }

    _.extend(Mask.prototype, Compiler, Generator, {
        init: function(){
            this.compile();

            _.each(this.options.templates, this.addTemplate, this);
            _.each(this.options.translator, this.addTranslator, this);
        },

        register: function(source, template){
            var code = this.generate(
                    template || this.options.template,
                    typeof source === 'string'? this.compile(source) : source
                );

            // in the browser
            appendScript(code);

            // on the server ...
        },

        _translator: {
            content: function(abstract, key){
                var c = abstract.content, marker = this.options.marker;
                if(!c) return key;

                return _.map(c, function(el){
                    if(typeof el === 'string') return Generator.stringify(c);
                    return  marker[abstract.token[0].marker].translator? marker[abstract.token[0].marker].translator.call(this, abstract, key) : this._translator.token.call(this, abstract, key);

                }).join(' + ');
            },

            token: function(abstract, key){
                var nested = !!abstract.content.length;

                if(nested) this.register(abstract);

                return "$.handle('" +
                    abstract.token[0].$namespace + "'" +
                    (nested? ", '" + abstract.namespace + "'" : "") +
                ')';
            }
        }
    });

    _.extend(Mask, {
        View: View,
        Generator: Generator,

        t: function(template,options){ return new Mask(template,options); },
        render: function(template, data, scope){ return Renderer.run(data, template, scope); },
        noconflict: function(){ root.Mask = prevMask; return this; },

        v: {}
        });

    // Utils
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
                    exp:'(#param:#namespace)',
                    translator: function(abstract, key){
                        return "$.handle(" + abstract.token[0]['$namespace'] + ")";
                    }
                    //priority:0
                },

                "condition":{
                    exp: "(#param:%ns)(?:(#param:==|!=|<|>|<=|>=)(#param:%ns))?\\?(#param:#namespace)(?:\\:(#param:%ns))?"
                }
            },
            template: 'View',
            templates:{
                View: function() {
                    /** @marker */ var NAMESPACE, CONTENT;

                    Mask.v['NAMESPACE'] = Mask.View.extend({
                        render:function (data) {
                            var $ = this;
                            if(data) $.data = data;

                            return CONTENT;
                        },
                        initialize: function () {}
                    });
                }
            },
            translator:{},
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

    if(typeof module !== 'undefined') module.exports = Mask;
    else root.Mask = Mask;

    //return Mask;
}(window, document));
