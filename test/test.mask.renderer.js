//     test.mask.renderer.js

//     (c) 2012 Simon Bekoe
//     Mask.Renderer unit tests


module('Mask.View');
test('getData()',function(){
    var
        // initialize context
        _top = {
            a: 1,
            b: 2,
            c: {
                d:"e"
            }
        },
        top = new Mask.View({data:_top}),

        // initialize nested context
        _nested = {
            a: 2,
            "c.d": {
                e: "f"
            }
        },
        nested = Mask.View.create({data:_nested, parent: top});

    equal(top.getData('a'), 1, 'simple attribute');
    equal(top.getData('c.d'), 'e', 'resolve path');


    equal(nested.getData('c.d'), _nested['c.d'], 'resolve path defined in attribute');
    equal(nested.getData('a'), 2, 'overwrite attr of parent context');
    equal(nested.getData('b'), 2, 'get attr of parent context');
    equal(nested.getData(':b'), undefined, 'get undefined attr of current context which is defined in the parent context');
    equal(nested.getData('.'), _nested, 'get current context (with namespace delimiter)');
    equal(nested.getData(':'), _nested, 'get current context (with context holder)');
    equal(nested.getData('..'), _top, 'get parent context (with namespace delimiter)');
    equal(nested.getData('.:'), _top, 'get parent context (with context holder)');
    equal(nested.getData('..a'), 1, 'attr of parent context which is overwritten in current context');
    equal(nested.getData('..b'), 2, 'attr of parent context which is NOT overwritten in current context');
});

