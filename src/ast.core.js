var AST = (function(){
  var
    defaults = {
      stream: '',
      index: [],
      tokens: [],
      content: [],
      type: 'text',
      //@deprecated
      status: 'init',
      state:{},
      isReverse: false,
      hasNests: true,
      namespace: 'root',
      parentPath: '',
      valid: true
    },
    coreAttributes = _.keys(defaults),
    shorthands = ['namespace', 'valid', 'status', 'type', 'stream'];

  var AST = function AST(attributes){
    if(attributes instanceof AST) return attributes;
    
    if(!(this instanceof AST)) return new AST(attributes);

    _.extend(this, defaults, attributes);
  };

  var proto = _.extend(AST.proto, Events);

  // register shorthands: isAttribute, setAttribute, getAttribute
  _.each(shorthands, function(attribute){
    var camelizedName = attribute[0].toUpperCase() + attribute.slice(0);
    
    proto['is' + camelizedName] = proto['has' + camelizedName] = function(value){
      return arguments.length? this[attribute] == value : !!this[attribute];
    };

    proto['set' + camelizedName] = function(value, silent){
      return this.set(attribute, value, silent);
    };

    proto['get' + camelizedName] = function(save)){
      return this.get(attribute, save);
    };

    proto.['default' + camelizedName] = function(value, silent){
      return this.set(attribute, value, silent, true);
    }

  });

  proto.appendToken = function(token) {
    this.tokens.push(token);
    this.trigger('appendToken', token);
    return this;
  };

  proto.prependToken = function(token){
    this.tokens.splice(0, 0, token);
    this.trigger('prependToken', token);
    return this;
  };

  proto.appendContent = function(content) {
    this.content[0].push(content);
    this.trigger('appendContent', content);
    return this;
  };

  proto.prependContent = function(content){
    this.content[0].splice(0, 0, content);
    this.trigger('prependContent', content);
    return this;
  };

  proto.newContent = function(){
    this.content[0].push(child);
    return this;
  };

  proto.addState = function(state){
    this.state[state] = true;
    return this;
  };

  proto.removeState = function(state){
    delete this.state[state];
    return this;
  };

  proto.hasState = function(state){
    return !!this.state[state];
  };

  proto.reverse = function(){
    if(!this.isReverse) _.invoke(this.content,'reverse');
    this.isReverse = true;
    return this;
  };

  proto.forward = function(){
    if(this.isReverse) _.invoke(this.content,'reverse');
    this.isReverse = false;
    return this;
  };

  // prefix namespace with parentPath or return namespace
  proto.getPath = function(){
    return (this.parentPath? this.parentPath + NAMESPACE_DELIMITER : '') + this.getNamespace(true);
  };

  proto.getAbstract = function(){
    return {
      tokens: this.get('tokens', true),
      content: this.get('content', true),
      namespace: this.getNamespace(true),
      path: this.getPath()
    };
  };

  proto.set = function(attr, val, silent, _default, _oldValue){
    var oldVal, oldValues = {}, c, a;
    
    if(typeof attr !== 'string'){
      for(a in attr){
        c = this.set(a, attr[a], val, silent, true);
        if(c !== this) oldValues[attr] = c;
      }
      
      if(_.size(oldValues) !== 0) this.trigger('change', oldValues);

      return this;
    }

    oldVal = this[attr];

    if(oldVal === val ) return this;
    if(_default && oldVal !== undefined && oldVal !== null) return this;

    this[attr] = val;

    if(!silent && oldVal !== undefined)
      console.warn('AST: override attribute "%s" = %o with %o while %s', attr, oldVal, val, this.status || 'setting');

    this.trigger('set change:' + attr, val, oldVal, attr);

    return _oldValue? oldVal : this;
  };

  proto.defaults = function(attr, value, silent){
    return this.set(attr, value, silent, true);
    // if (arguments.length) _.defaults.apply(null,[this].concat(_.toArray(arguments)));
    // else _.extend(this, defaults);
    // return this;
  };

  proto.get = function(attr, save){
    if(save && data[attr] === undefined) throw 'AST: data["'+attr+'"] is undefined!';
    return data[attr];
  };

  proto.is = proto.has = function(attribute, value){
    return arguments.length > 1? this[attribute] == value : !!this[attribute];
  };


  


  return AST;
})();