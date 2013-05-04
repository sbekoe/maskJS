var Abstract = (function(){
  var Abstract = function(data) {
    if(data instanceof Abstract)
      return data;
    if(!(this instanceof Abstract))
      return new Abstract(data);

    this.set = function(attr, val, silent){
      set(this, data, attr, val, silent);
      return this;
    };

    this.get = function(attr){
      return data[attr];
    };
  };

  
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

  _.extend(Abstract.prototype, Backbone.Events);
  return Abstract;
})();