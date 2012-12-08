/**
 * Created with JetBrains PhpStorm.
 * User: simon
 * Date: 11/27/12
 * Time: 8:25 PM
 */

function Compiler(mask){
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
    this.analyse();
    this.synthesize(this.mask.template);
    this.generate();
}

Compiler.prototype = {
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
                {"id":"(#param:%ns)","ns":"%w(?:\\.%w)*","ls":"(?:^[ \\t]*)?","le":"(?:[ \\t]*\\n)?","n":"\\n","s":"[ \\t]*","w":"\\w+", "namespace":"%ns"},
                {opener:'#delimiterL#logic#delimiterR', closer:[], delimiterL:[], delimiterR:[], logic:[]}
            ),
            part,id;

        // sort patterns
        for(m in pattern){if(pattern.hasOwnProperty(m)){ patternOrder.push(m); pattern[m].name = m;}}
        patternOrder.sort(function(m1,m2){
            return (pattern[m2].priority||0) - (pattern[m1].priority||0) || pattern[m2].token.length - pattern[m1].token.length;
        });
        // split token into opener, divider & closer
        for(i=0; i<patternOrder.length; i++){
            p = pattern[patternOrder[i]];
            // new
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
//			console.log(wildcards);

        for(m in marker){if(marker.hasOwnProperty(m)){ markerOrder.push(m); }}
        markerOrder.sort(function(l1,l2){
            return marker[l2].priority - marker[l1].priority || marker[l2].exp.length - marker[l1].exp.length;
        });
        // build the selector regexp part
        for(i=0; i<markerOrder.length; i++){
//				wildcards.logic.push(m.exp2|| m.exp);
            wildcards.logic.push(marker[markerOrder[i]].exp2);
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
            nested;
        while(token = nextToken.exec(stream)){
            switch(token[1]){
                case 'text':
                    tokens.push('"' + esc(this.objects[token[2]]) + '"');
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
                        tokens.push("handle('" + namespace + "', self, '" + path + "')");
                        if(nested !== ''){
                            this.generate({stream:nested, namespace:path});
                        }
                    }else{
                        throw ('no opener found for the token: ' + token[0]);
                    }
                    break;
                case 'opener':
                    references.push(namespace = (this.objects[token[2]]['$namespace'][0]||'').split(NAMESPACE_DELIMITER_EXP));
                    tokens.push("handle('" + namespace + "', self)");
                    break;
            }

        }
        registerTemplate(parentNamespace, tokens.reverse(), references, 'Mask.Renderer');
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
    }

};
