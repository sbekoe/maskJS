var View = (function(){
  // The view layer
  // The output classes will inherit from this class as default
  var View = function(options){
    this.data = {};
    this.meta = {};
    this.parent = {};
    this.nested = [];
    this.index = 0;

    // to enable data traversing (accessing parents data by there getData fct)
    // getData should always be bound to its owner
    this.getData = _.bind(this.getData, this);

    this._configure(options || {});
    this.initialize.apply(this, arguments);

    // register this instance in its parent if one exist
    if(this.parent.nested !== undefined) this.index = this.parent.nested.push(this) - 1;

  };

  var viewOptions = ['data', 'meta', 'parent'];

  View.prototype = {
    initialize: function(){},

    nest: function(data, viewPath){
      var
        view = Mask.v[viewPath],
        // metadata scope provides runtime data
        meta = {i:0, n:0};

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

    handle: function(dataPath, viewPath){
      var data = this.getData(dataPath);
      switch(typeof data){
        case 'string':
        case 'number': return data;
        case 'boolean': return data? PATH_ATTR.exec(dataPath)[1] : '';
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
  };

  View.create = function(options){ return new this(options); };
  
  return View;
})();