(function($){
    $(function(){
        $('.test textarea').keyup(showUnitTest);
    });

	jQuery.fn.codemirror = function(options){
		return this.each(function(){$(this).data('codemirror',CodeMirror.fromTextArea(this, options || {}));});
	}

	jQuery.getJSON('tests.json',{},init);

    function parseOptions(json){
        var options = {};
        try{
            options = eval('('+json+')');
        }
        catch(e){
            console.log('Error while parsing Options: ' + json + ' is no valid object!');
        }
        return options;
    }

    function showUnitTest(editor,event){
        $('.unitTest').text(
            JSON.stringify({
                name:"test",
                template: $('[name="template"]').data('codemirror').getValue(),
                result: $('[name="result"]').data('codemirror').getValue(),
                data: parseOptions($('[name="data"]').data('codemirror').getValue()),
                options: parseOptions($('[name="options"]').data('codemirror').getValue())
                //data: $('[name="data"]').data('codemirror').getValue(),
                //options: $('[name="options"]').data('codemirror').getValue()
            })
        );
    }

    function init(tests){
        var t,i,
			codeMirrorOptions = {
				lineNumbers:true,
				onKeyEvent: showUnitTest
			};

        if(tests.length){
            t = tests[tests.length-1]; //show last unit test
            $('[name="template"]')
				.val(t.template)
				.codemirror(codeMirrorOptions);
            $('[name="result"]')
				.val(t.result)
				.codemirror(codeMirrorOptions);
            $('[name="options"]')
				.val(formatJson(JSON.stringify(t.options)))
				.codemirror(codeMirrorOptions);
			$('[name="data"]')
				.val(formatJson(JSON.stringify(t.data)))
				.codemirror(codeMirrorOptions);
        }

		test( "full test", function() {
			for(i=0; i<tests.length; i++){
                //console.log(test=tests[i].template,tests[i].options,tests[i].data);
                var mask = Mask.t(tests[i].template,tests[i].options);
                //console.log(Mask.t(tests[i].template,{}));
				equal(mask.render(tests[i].data),tests[i].result,tests[i].name);
				//ok( true, "true succeeds" );
			}
		});



        showUnitTest();
    }
	// formatJson() :: formats and indents JSON string
	// from http://ketanjetty.com/coldfusion/javascript/format-json/
	function formatJson(a){var b="";var c=a;var d=0;var e=c.length;var f="  ";var g="\n";var h="";for(var i=0;i<e;i++){h=c.substring(i,i+1);if(h=="}"||h=="]"){b=b+g;d=d-1;for(var j=0;j<d;j++){b=b+f}}b=b+h;if(h=="{"||h=="["||h==","){b=b+g;if(h=="{"||h=="["){d=d+1}for(var k=0;k<d;k++){b=b+f}}}return b}
})(jQuery);