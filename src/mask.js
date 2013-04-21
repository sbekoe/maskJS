(function (root, factory) {

  if (typeof exports === 'object') {
    var underscore = require('underscore');
    var backbone = require('backbone');
    module.exports = factory(underscore, backbone);
  } else if (typeof define === 'function' && define.amd) {
    define(['underscore', 'backbone'], factory);
  } else {
    var _ = root._;
    var backbone = root.backbone;
    root.Mask = factory(_, backbone);
  }

}(this, function (_, backbone) {


  var
    NAMESPACE_DELIMITER = '.',
    NAMESPACE_DELIMITER_EXP = /\./g,
    NAMESPACE_HOLD = ':',
    PATH_ATTR = RegExp('(?:^|\\' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')(\\w+)$'),
    PATH_OBJ = RegExp('(\\w+)(?:$|' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')'),

    root = this,
    prevMask = this.Mask;

  @@Compiler

  @@Generator

  @@View

  @@Mask
  

  // Utilities
  var  options = function(obj) {
      _.each(_(arguments).slice(1), function(source) {
        if (source) {
          for (var prop in source) {
            if(_.isArray(source[prop]) && _.isArray(obj[prop])) {
              obj[prop] = source[prop].concat(obj[prop]);
            } else if(_.isObject(source[prop]) && _.isObject(obj[prop])) {
              obj[prop] = options({}, obj[prop], source[prop]);
            } else {
              obj[prop] = source[prop];
            }
          }
        }
      });
      return obj;
    },

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

  Mask.View = View;
  Mask.Generator = Generator;

  return Mask;
}));
