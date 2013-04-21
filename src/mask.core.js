var Mask = (function(){
  var Mask  = function (options) {
    this.init(options);
  }

  _.extend(Mask.prototype, Compiler, Generator, Backbone.Events,{
    init: function(options){
      options = _.isObject(options)? options : presets[options] || presets['default'];

      this.options = {};

      this.configure(defaults, presets[options.preset] || {}, options);

      _.each(this.options.templates, this.addTemplate, this);
      _.each(this.options.translator, this.addTranslator, this);
     // _(this.options.events).each(this.on,this);
      this.on(this.options.events || this.options.on || {})
    },

    configure: function(){
      options.apply(this, _(arguments).splice(0, 0, this.options));
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

    create: function(namespace, options){
      return Mask.create(namespace, options);
    },

    _translator: {
      content: function(abstract, key){
        var
          that = this,
          content = abstract.content[0],
          marker = this.options.logic,
          blockBehaviour,
          tokenBehaviour;
        if(!content) return key;

        return _.reduce(abstract.content, function(memo, content, index){
          that.trigger('generate:block:' + abstract.token[index].lkey,
            blockBehaviour = {
              content: _.map(content, function(el,j){
                that.trigger('generate:token:' + abstract.token[index].lkey,
                  tokenBehaviour = {
//                    content: typeof el === 'string'? Generator.stringify(el) : marker[el.token[index].lkey].translator? marker[el.token[index].lkey].translator.call(that, el, key) : that._translator.token.call(that, el, key),
                    content: typeof el === 'string'? Generator.stringify(el) : that._translator.token.call(that, el, key),
                    index:j,
                    abstract: abstract
                  }
                );
                return tokenBehaviour.content;
              }).join(' + '),
              token: abstract.token[index],
              index: index,
              abstract: abstract
            }
          );
          return memo + blockBehaviour.content;
        },'');
        //return content;
      },

      token: function(abstract, key){
        var nested = !!abstract.content.length;

        if(nested) this.register(abstract);

        return "$.handle('" +
          abstract.token[0].namespace + "'" +
          (nested? ", '" + abstract.namespace + "'" : "") +
          ')';
      }
    },
    debug: true
  });

  _.extend(Mask, {
    create: function(namespace, options){
      error(!_.isFunction(this.v[namespace]), 'The view class  >>' + namespace + '<< doesn\'t exist');

      return new this.v[namespace](options);
    },

    noconflict: function(){ root.Mask = prevMask; return this; },

    v: {}
  });

  
  var presets = Mask.presets = {
      default:{}
    },

    defaults = Mask.defaults = {
      data:{},
      syntax:[
       { skey: 'mustache', token:'{{ ? }}'}
      ],
      wildcards: {
        "id":"(#param:%ns)", // id for closing marker
        "ns":"%w(?:\\.%w)*", // the namespace to be resolved while getting data
        "ls":"(?:^[ \\t]*)?", // line start
        "le":"\\n?", // line end
        "n":"\\n", // line break
        "s":"[ \\t]*", // white space (no line breaks)
        "w":"\\w+", // word
        "namespace":"%ns", // namespace
        "path": "\\w+(?:\\.(?:\\w+|\\[\\d+\\]))*"
      },
      //logic
      multipleLogic:true,
      logic:[
        { lkey:'path', exp:'(#param:#namespace)' }
      ],
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
    };

  return Mask;
})();