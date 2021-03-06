// Helpers
var 
  options = function(obj) {
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
      m = meta || {};
    return n === '' ? data :                                // current context
      (r = data[n] || m[n]) !== undefined? r :         // attr of current or meta context context
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
    child.prototype = new Surrogate();

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
  output = function(type, values){
    var args = _.rest(arguments);
    _.defer(function(){ throw type.toUpperCase() + values; });
    console.log('test');
    console.warn('foo %s', 'bar');
  };

  var console = new Console({quiet:false});



  // underscore helpers
  var 
    chain = _.chain;