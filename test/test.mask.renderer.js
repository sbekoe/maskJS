//     test.mask.renderer.js

//     (c) 2012 Simon Bekoe
//     Mask.Renderer unit tests

module('Mask.Renderer');
test('scope()',function(){
	// initialize context
	var _top = {a:1, b:2, c:{d:"e"}};
	var scope = Mask.Renderer.scope(_top)
	equal(scope.data('a'), 1, 'simple attribute');
	equal(scope.data('c.d'), 'e', 'resolve path');

	// add new context to the scope
	var _2nd = {a:2,"c.d":{e:"f"}};
	scope = Mask.Renderer.scope(_2nd, scope)
	equal(scope.data('c.d'), _2nd['c.d'], 'resolve path defined in attribute');
	equal(scope.data('a'), 2, 'overwrite attr of parent context');
	equal(scope.data('b'), 2, 'get attr of parent context');
	equal(scope.data(':b'), undefined, 'get undefined attr of current context which is defined in the parent context');
	equal(scope.data('.'), _2nd, 'get current context (with namespace delimiter)');
	equal(scope.data(':'), _2nd, 'get current context (with context holder)');
	equal(scope.data('..'), _top, 'get parent context (with namespace delimiter)');
	equal(scope.data('.:'), _top, 'get parent context (with context holder)');
	equal(scope.data('..a'), 1, 'attr of parent context which is overwritten in current context');
	equal(scope.data('..b'), 2, 'attr of parent context which is NOT overwritten in current context');

//	TODO:
//	An implementation of the following spec would cause a few problems:
//	- slower set up of scopes because of finding path-attributes and parsing them: "c.d" => {c:{d: {e:'f'}}
//	- overwriting parent contexts with subsets of the parsed path
//	deepEqual(
// 		scope.data('c'),
// 		{d:{e:'f'}}
// 	);
//	equal(
// 		scope.data('c.d.e'),
// 		'f'
// 	);
});

