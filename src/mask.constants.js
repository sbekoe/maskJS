// global constants
var
  NAMESPACE_DELIMITER = '.',
  NAMESPACE_DELIMITER_EXP = /\./g,
  NAMESPACE_HOLD = ':',
  PATH_ATTR = RegExp('(?:^|\\' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')(\\w+)$$'),
  PATH_OBJ = RegExp('(\\w+)(?:$|' + NAMESPACE_DELIMITER + '|' + NAMESPACE_HOLD + ')'),

  root = this,
  prevMask = this.Mask;

// API strings
var
  LCAP = 'logic',
  LKEY = 'lkey', // logic key
  SKEY = 'skey'; // syntax key
