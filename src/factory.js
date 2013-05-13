(function (root, factory) {

  if (typeof exports === 'object') {
    var underscore = require('underscore');
    var backbone = require('backbone');
    module.exports = factory(underscore, backbone);
  } else if (typeof define === 'function' && define.amd) {
    define(['underscore', 'backbone'], factory);
  } else {
    root.Mask = factory(root._, root.Backbone);
  }

}(this, function (_, Backbone) {
  var Events = Backbone.Events;

  @@constants

  @@abstract

  @@ast

  @@compiler

  @@generator

  @@view

  @@mask

  @@console

  @@helpers

  var console = new Console({quiet:false});

  Mask.Abstract = Abstract;

  Mask.AST = AST;

  Mask.Compiler;

  Mask.Generator = Generator;

  View.extend = extend;

  Mask.View = View;

  Mask.VERSION = '@@version';

  return Mask;
}));
