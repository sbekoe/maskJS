var Generator = (function(){
  var Generator = {

    // produces a js string from a js template and and an abstract holding additional info
    generate: function(template, asbstract){
      var
        tpl = this._template[template || this.option.template] || console.error('Generator: The template' + template + 'do not exist.'),
        tokens = tpl.tokens.slice(0),
        trl = this._translator,
        key, key2, result;

      asbstract = asbstract || this.asbtract || {};

      
      for(var i in tpl.key)
        tokens[i] = this.translate(asbstract, tpl.key[i]);

      return tokens.join('');
    },


    // call a translator,
    // directly use an abstract attribute
    // or reinsert the key
    translate: function(abstract, key){
      var
        _key = key.toLowerCase(),
        trl = this._translator[key] || this._translator[_key];

      return (trl && trl.call(this, abstract, key)) ||
        abstract[key] ||
        abstract[_key] ||
        key;
    },

    // Hold an api for adding new templates
    addTemplate: function(template, key){
      var match, keys, tpl = {tokens:[], key:{}}, prevIndex = 0, offset;
      this._template || (this._template = {});

      if(!!this._template[key])
        console.warn('Generator: Overwrite template "%s"', key);

      switch(typeof template){
        case 'function':
          template = template.toString();
        case 'string':
          match = this._keyList.exec(template) || {};
          keys = match[1]? match[1].split(/\s*,\s*/) : [];
          keys.push('_([A-Z]+)_');
          keys = new RegExp(keys.join('|') ,'g');

          template = template.slice(
            this._keyList.lastIndex || template.indexOf('{') + 1,
            template.lastIndexOf('}')
          );

          if((offset = this._offset.exec(template)[0]).length)
            template = template.replace(new RegExp('(^|\\n)' + Generator.esc(offset, true),'g'),'$1');
          template = template.replace(/\s*$/,'');
          while(match = keys.exec(template)){
            tpl.tokens.push(
              template.slice(prevIndex, match.index),
              undefined
            );
            tpl.key[tpl.tokens.length - 1] = match[1] || match[0];
            prevIndex = keys.lastIndex;
          }
          tpl.tokens.push(template.slice(prevIndex));

          this._template[key] = tpl;
          this._keyList.lastIndex = 0;
          break;

        case 'object':
          this._template[key] = template;
          break;
      }

      return this;
    },

    // Hold an api for adding new translator functions
    addTranslator: function(fct, key){
      if(!!this._translator[key])
        console.warn('Generator: Overwrite translator "%s"', key);
      this._translator[key] = fct;

      return this;
    },

    _template: {},
    _translator: {},
    _offset: /^[\s\t]*/,
    _keyList: /\s*\/\*\*\s*@marker\s*\*\/\s*var\s*([^;]+)\s*;\n*/g,


    // Utils
    esc: function(str){
      return str
        .replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\\"')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
    },

    stringify: function(str){
      return '"' + this.esc(str) + '"';
    }
  };

  return Generator;
})();