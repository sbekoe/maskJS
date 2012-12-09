module('Mask.Generator');

test('full api',function(){


    Mask.Generator.addTemplate('View', function() {
        /** @marker */ var NAMESPACE, CONTENT;

        Mask.v['NAMESPACE'] = Mask.View.extend({
            render:function (data) {
               var $ = this;
               if(data) $.data = data;

               return CONTENT;
            },
            initialize: function () {}
        });
    });

    Mask.Generator.addTranslator('CONTENT', function(context, key) {
        var c = context.content, i;
        if(!c) return key;

        for(i = 0; i< c.length; i++) c[i] = Mask.Generator.stringify(c[i]);

        return context.content.join(' + ');
    });

    equal(
        Mask.Generator.render('View',{
            namespace:'main'
        }),
        "        Mask.v['main'] = Mask.View.extend({\n            render:function (data) {\n               var $ = this;\n               if(data) $.data = data;\n\n               return CONTENT;\n            },\n            initialize: function () {}\n        });\n    "
    )
});