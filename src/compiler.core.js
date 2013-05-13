var Compiler = (function(){

  // Multi-pass compiler
  // The compiler builds the abstract layer (syntax tree) in three steps:
  // - generating a lexer from the syntax definitions
  // - scanning for all tokens in the template
  // - constructing the tree backwards (looking for block closers first and for matching openers then)
  var Compiler =  {
    // compile: function(source, options){
    compile: function(abstract){
      // enable use by prototype extension and standalone
      this.source = source || this.source || '';
      this.options = options || this.options || {};

      // var abstract = Abstract(abstract);
      var ast = new AST(abstract);

      // define() is kind of a scanner generator lexer = scanner
      this.lexer = this.define();

      // lexical analyse: produces also tokens 'stream' which is used in the parser
      // this.tokens = this.scan();
      // this.scan(abstract);
      this.scan(ast);

      // syntactic analyse: build abstract syntax tree
      // this.abstract = this.parse();
      // return this.parse(abstract);
      return this.parse(ast);
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

    // Lexical analysis (scanner)
    // scan: function(source){
    scan: function(ast){
      var
        // src = source || this.source,
        src = abstract.get('source'),
        index = this.lexer.parse(src),
        stream = index
          .map(function(token, i){
              if(typeof token === 'string') return 'text ' + i;
              else return token.atm('type') + ' ' + i + (' ' + (token.atm('skey') || '')) + (' ' + (token.cap(['param']).join(' ') || ''));
            })  
          .reverse()
          .join('\n');

      // this.stream = stream;

      // return index.value();
      
      ast.set({
        index: index,
        stream: stream
      });

      return this;
    },

    // parse: function(s,a){
    parse: function(ast){
      ast
        .defaultNamespace('root')
        .newContent()
        .addState('parseContent');
        // .set({content: [], token: [] })
      var
        _this = this,
        abstract = a || {namespace: this.namespace || 'root', content:[[]], token:[]},
        // stream = s || this.stream,
        stream = abstract.get('stream', true),
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
        if(hash[1] !== 'text'){
          child = AST({
            namespace: token.cap('namespace') || token.cap('param'),
            // content: [],
            // token: [],
            type: hash[1],
            status: 'parsing'
          });
          /*
          behaviour = {
            complete: true,
            valid: true,
            namespace: token.cap('namespace') || token.cap('param') || ''
            // namespace: token.cap('namespace')? token.cap('namespace')[0] : token.cap('param')? token.cap('param')[0] : ''
          };
          */

          this.trigger('parse:syntax:' + token.atm('skey'),
            chlid,
            token
            //,behaviour
          );

          // if(token.cap('logic')) _.each(token.cap(['logic']), function(l){
          if(token.cap('logic')) token.cap('logic').each( function(logicToken){
            // this.trigger('parse:logic:' + l.atm('lkey'), token, child, behaviour, l);
            _this.trigger('parse:logic:' + logicToken.atm('lkey'), child, token, logicToken);
          });
        }

        // if(!behaviour.valid && hash[1] !== 'text') continue;
        if(child.isValid()) continue;

        // behaviour = {};

        switch(hash[1]){
          case 'text':
            child = this.tokens[hash[2]];
            break;
          case 'closer':
            child
              .addToken(token)
              .addState('parseMarker');
            //TODO: nextToken.mode('indexedOpener opener').update({wildcards:{type:hash[3], param:hash[4]})
            nextIndexedOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ') .*('+ hash[4] + ').*$$','gm'); // insert pattern and id/closer id
            nextOpener = new RegExp('^(opener) (\\d+) (' + hash[3] + ').*$$','gm'); // insert pattern
            nextIndexedOpener.lastIndex = nextOpener.lastIndex = nextToken.lastIndex;
            /*
            ohash = nextIndexedOpener.exec(stream) ||
              nextOpener.exec(stream) ||
              error(this.debug, '(Compiler) No opener found for the token: ' + hash[0]);
            //*/

            // while(!behaviour.complete && (ohash = nextIndexedOpener.exec(stream) || nextOpener.exec(stream))){
            while(child.hasState('parseMarker') && (ohash = nextIndexedOpener.exec(stream) || nextOpener.exec(stream))){
              token = this.tokens[ohash[2]];
              /*
              behaviour = {
                complete:true,
                valid:true,
                namespace: token.cap('namespace') || token.cap('param') || ''
                // namespace: token.namespace? token.namespace[0] : token.param? token.param[0] : ''
              };  
              //*/
              _this.trigger('parse:syntax:' + token.atm('skey'), child, token);

              token.cap('logic').each(function(l){
                _this.trigger('parse:logic:' + l.atm('lkey'), child, token, l);
              });

              nextIndexedOpener.lastIndex = nextOpener.lastIndex = ohash.index + ohash[0].length;

              if(!child.isValid()) continue;

              // child.token.splice(0, 0, token);
              child
                .prependToken(token)
                .setStream(stream.slice(nextToken.lastIndex, ohash.index))
                .defaultNamespace(token.cap('namespace') || token.cap('param'));

              // nested = stream.slice(nextToken.lastIndex, ohash.index);
              // child.namespace = child.namespace || abstract.namespace + NAMESPACE_DELIMITER + behaviour.namespace;
              nextToken.lastIndex = ohash.index + ohash[0].length;

              // if(nested !== ''){
              if(child.hasStream()){
                // child.content.splice(0, 0, []);
                // this.parse(nested, child);
                // child.newContent();
                this.parse(child);
              }
            }


            break;
          case 'opener':
            // child.token.splice(0, 0, token);
            child.prependToken(token);
            break;
        }

        // ast.content[0].push(child);
        ast.appendContent(child.removeState('parseMarker'));

      }

      // _.invoke(ast.content,'reverse');
      return ast
        .forward()
        .removeState('parseContent');

      // return ast;
    }


  };
  return Compiler;
})();