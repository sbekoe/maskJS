module('Mask.Generator');

test('full api',function(){
    var Generator = Mask.Generator;

    Generator.addTemplate('View', function() {
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

    Generator.addTranslator('CONTENT', function(context, key) {
        var c = context.content, i;
        if(!c) return key;

        for(i = 0; i< c.length; i++) c[i] = Generator.stringify(c[i]);

        return context.content.join(' + ');
    });

    equal(
        Generator.generate('View',{
            namespace:'main',
            content:['1','2','3']
        }),
        "Mask.v['main'] = Mask.View.extend({\n    render:function (data) {\n       var $ = this;\n       if(data) $.data = data;\n\n       return \"1\" + \"2\" + \"3\";\n    },\n    initialize: function () {}\n});"
    )
});