var Compiler = (function(){

  // Multi-pass compiler
  // The compiler builds the abstract layer (syntax tree) in three steps:
  // - generating a lexer from the syntax definitions
  // - scanning for all tokens in the template
  // - constructing the tree backwards (looking for block closers first and for matching openers then)
  var Compiler =  {
    compile: function(source, options){
      // enable use by prototype extension and standalone
      this.source = source || this.source || '';
      this.options = options || this.options || {};

      // define() is kind of a scanner generator lexer = scanner
      this.lexer = this.define();

      // lexical analyse: produces also tokens 'stream' which is used in the parser
      this.tokens = this.scan();

      // syntactic analyse: build abstract syntax tree
      this.abstract = this.parse();

      return this.abstract;
    },

    define: function(){
      var
        splitter = new Exp({
          source: "^#leftBound%logic#rightBound?$|^#leftBound?%logic#rightBound$",
          wildcards:{
            logic: '\\?|\\%id',
            leftBound:/.+/,
            rightBound:/.+/
          }
        }),

        leftBound_exp =  [],
        rightBound_exp =  [],
        lb = [],
        rb = [],
        logic_exp = [],

        lexer = {
          source: '#delimiterL#logic{1,,\\s+}#delimiterR',
          global: true,
          multiline: true,
          captureRepetition: true,
          wildcards: _.extend(
            this.options.wildcards,
            {
              delimiterL: leftBound_exp,
              delimiterR: rightBound_exp,
              logic: logic_exp
            }
          ),
          assignments: {
            s: this.options.syntax,
            l: this.options.logic
          }
        };

      // sort patterns and split there tokens into opener, divider & closer
      _.chain(this.options.syntax)
        .sort(function(s1,s2){ return (s2.priority||0) - (s1.priority||0) || s2.token.length - s1.token.length; })
        .each(function(s,index){
          s['behaviour'] = [];
          _.each(s.token.replace(/ /g, '%s').split('|'), function(p, i, list){
            var
              part = splitter.exec(p),
              part_lb = part.cap('leftBound'),
              part_rb = part.cap('rightBound'),
              l = !part_lb? false : s.trimBlockBound? '%ls' + part_lb: part_lb,
              r = !part_rb? false : s.trimBlockBound? part_rb + '%le' : part_rb,
              uniqueLBound = -1 === _.indexOf(lb, l),
              uniqueRBound = -1 === _.indexOf(rb, r);

            if(!part)
              console.error('Compiler: Invalid syntax definition in part %d of rule %s', i, s.skey);
            
            if(!uniqueLBound || !uniqueRBound)
              console.warn('Compiler: non-unique part %d in syntax definition %s %o', i, s.skey, s);

            s['behaviour'][i] = {
              part: i,
              skey: s.skey,
              type: i !== 0 && i === list.length - 1? 'closer' : 'opener',
              lb: l,
              rb: r
            };

            if(part_lb){
              lb.push(l);
              leftBound_exp.push('(' + Exp.esc(l, true) + ')>s.' + index + '.behaviour.' + i);  
            }

            if(part_rb){
              rb.push(r);
              rightBound_exp.push('(' + Exp.esc(r, true) + ')' + (uniqueLBound? '>' : '>>') + 's.' + index + '.behaviour.' + i);
            }
          });
        });

      // sort the markers/logic and build the selector regexp part
      _.chain(this.options.logic)
        .sort(function(l1,l2){ return (l2.priority||0) - (l1.priority||0) || l2.exp.length - l1.exp.length; })
        .each(function(l, i){
          logic_exp.push('(' + l.exp + ')>l.' + i);
        });

      return new Exp(lexer);
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
        // return match.type + ' ' + (tokens.push(match) - 1) + (' ' + (match.skey || '')) + (' ' + (match.param.join(' ') || ''));
        return match.atm('type') + ' ' + (tokens.push(match) - 1) + (' ' + (match.atm('skey') || '')) + (' ' + (match.cap(['param']).join(' ') || ''));
       // return (match['opener']? 'opener ' : 'closer ') + (tokens.push(match)-1) + (' ' + (match.pattern || '')) + (' ' + (match.param.join(' ') || ''));
      });

      if(this.lexer.lastMatch) stream.push('text ' + (tokens.push(src.slice(this.lexer.lastMatch.range[1]))-1));

      this.stream = stream.reverse().join('\n');

      return tokens;
    },

    parse: function(s,a){
      var
        that = this,
        abstract = a || {namespace: this.namespace || 'root', content:[[]], token:[]},
        stream = s || this.stream,
        child,
        nextToken = /^(text|closer|opener) (\d+)(?: (\w+))?(?: (\w+))?.*$/gm,
        nextIndexedOpener,
        nextOpener,
        hash, // hash of a token
        ohash, // hash of an opener token
        nested,
        behaviour = {},
        token;

      while(hash = nextToken.exec(stream)){
        token = this.tokens[hash[2]];
        // if(this.trigger){
        if(this.trigger && hash[1] !== 'text'){
          this.trigger('parse:syntax:' + token.atm('skey'),
            token,
            child = {
              namespace:'',
              content:[],
              token: []
            },
            behaviour = {
              complete:true,
              valid:true,
              namespace: token.cap('namespace') || token.cap('param') || ''
              // namespace: token.cap('namespace')? token.cap('namespace')[0] : token.cap('param')? token.cap('param')[0] : ''
            }
          );

          // if(token.cap('logic')) _.each(token.cap(['logic']), function(l){
          if(token.cap('logic')) token.cap('logic').each( function(l){
            this.trigger('parse:logic:' + l.atm('lkey'), token, child, behaviour, l);
          }, this);
        }

        if(!behaviour.valid && hash[1] !== 'text')
          continue;

        

        behaviour = {};

        switch(hash[1]){
          case 'text':
            child = this.tokens[hash[2]];
            break;
          case 'closer':
            child.token.splice(0, 0, token);
            //TODO: nextToken.mode('indexedOpener opener').update({wildcards:{type:hash[3], param:hash[4]})
            nextIndexedOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ') .*('+ hash[4] + ').*$$','gm'); // insert pattern and id/closer id
            nextOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ').*$$','gm'); // insert pattern
            nextIndexedOpener.lastIndex = nextOpener.lastIndex = nextToken.lastIndex;
            /*
            ohash = nextIndexedOpener.exec(stream) ||
              nextOpener.exec(stream) ||
              error(this.debug, '(Compiler) No opener found for the token: ' + hash[0]);
            //*/

            while(!behaviour.complete && (ohash = nextIndexedOpener.exec(stream) || nextOpener.exec(stream))){
              token = this.tokens[ohash[2]];

              if(this.trigger){
                this.trigger('parse:syntax:' + token.atm('skey'), token, child, behaviour = {
                  complete:true,
                  valid:true,
                  namespace: token.cap('namespace') || token.cap('param') || ''
                  // namespace: token.namespace? token.namespace[0] : token.param? token.param[0] : ''
                });

                token.cap('logic').each(function(l){
                // _.each(token.cap('logic'), function(l){
                  this.trigger('parse:logic:' + l.atm('lkey'), token, child, behaviour, l);
                }, this);
              }

              nextIndexedOpener.lastIndex = nextOpener.lastIndex = ohash.index + ohash[0].length;

              if(!behaviour.valid) continue;
              child.token.splice(0, 0, token);

              nested = stream.slice(nextToken.lastIndex, ohash.index);
              child.namespace = abstract.namespace + NAMESPACE_DELIMITER + behaviour.namespace;
              nextToken.lastIndex = ohash.index + ohash[0].length;

              if(nested !== ''){
                child.content.splice(0, 0, []);
                this.parse(nested, child);
              }
            }


            break;
          case 'opener':
            child.token.splice(0, 0, token);
            break;
        }

        abstract.content[0].push(child);

      }

      _.invoke(abstract.content,'reverse');

      return abstract;
    }


  };
  return Compiler;
})();