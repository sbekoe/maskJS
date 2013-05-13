var Abstract = (function(){
  var Abstract = function(data, pub) {
    if(data instanceof Abstract)
      return data;
    
    if(!(this instanceof Abstract))
      return new Abstract(data, pub);

    this.data = pub? data : {};

    this.enclose(data);
  };


  _.extend(Abstract.prototype, Backbone.Events, {
    extend: function(){
      _.extend.apply(null,[this].concat(_.toArray(arguments)));
      return this;
    },
    enclose: function(data){
      this.set = function(attr, val, silent){
        set(this, data, attr, val, silent);
        return this;
      };

      this.get = function(attr, save){
        if(save && data[attr] === undefined) throw 'Abstracts data["'+attr+'"] is undefined!';
        return data[attr];
      };

      this.defaults = function(){
        _.defaults.apply(null,[data].concat(_.toArray(arguments)));
        return this;
      };

      this.toJSON = function(){
        return JSON.strigify(data);
      };
    },

    // mask specific methods
    addToken: function(token){
      this.get('token',1).splice(0, 0, token);
    }
  });


  
  // set: function(hashmap, [,silent]){
  // set: function(attr, val [,silent]){
  var set = function(abstract, data, attr, val, silent){
    var oldVal, changes = {}, c, a;
    
    if(typeof attr !== 'string'){
      for(a in attr)
        if(c = set(abstract, data, a, attr[a], val))
          changes[attr] = c[0];
      
      if(_.size(changes) !== 0)
        abstract.trigger('change', changes);
    }

    oldVal = data[attr];

    if(oldVal === val) return null;

    data[attr] = val;

    if(!silent && oldVal !== undefined)
      console.warn('Abstract: override attribute "%s" = %o with %o while %s', attr, oldVal, val, data.status || 'setting');

    abstract.trigger('set change:' + attr, val, oldVal, attr);

    return [oldVal];
  };

  return Abstract;
})();