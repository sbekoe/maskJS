var Console = (function(console){
    if(Console)
      return Console;

    var
      Console = function(options){
        var o = options || {};
        this.quiet = !!o.quiet;
      },
      node = !window,
      phantom = navigator && /phantom/i.test(navigator.userAgent),
      msg_prefix = {
        warn: 'Warning: ',
        log: '',
        error: 'Error: '
      },
      method,
      placeholder = /%([sdo])/g;
    Console.quiet = false;
    Console.format = function(a){
      var
        args = [].slice.call(a),
        stringFirst = typeof args[0] === 'string';
      
      if(node && stringFirst)
        args[0] = args[0].replace(/%o/g,'%j');
      
      if((!console || phantom) && stringFirst && args.length > 1)
        args[0] = args[0].replace(placeholder, function(m,p){
          if(!args[1]) return m;
          var a = args.splice(1,1)[0];
          switch(p){
            case 's': return '' + a;
            case 'd': return parseInt(a);
            case 'f': return parseFloat(a);
            default: return JSON && JSON.stringify(a) || '' + a;
          }
        });
      return args;
    };

    Console.prototype.put = function(msg){
      window.setTimeout(function(){ throw msg; }, 1);
      c.log('test');
    };

    for(method in msg_prefix)(function(method, prefix){
      Console[method] = Console.prototype[method] = function(){
        var args = Console.format(arguments);          
        return !this.quiet && (console && console[method] && !console[method].apply(console, args) || this.put(prefix + args.join()));
      };
    })(method, msg_prefix[method].toUpperCase());

    return Console;
  })((window || global).console);