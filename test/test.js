(function($){
	CodeMirror.modeURL = "vendor/CodeMirror2/mode/%N/%N.js";
    $(function(){
        $('.test textarea').keyup(updateCurrentTest);

		//change mode
		$('.test .mode').keyup(function(){
			var editor = $(this).siblings('textarea').data('codemirror'),
				mode = $(this).val();
			editor.setOption("mode", mode);
			CodeMirror.autoLoadMode(editor, mode);

		});
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

    function updateCurrentTest(){
        var t = {
			name:"test",
			template: $('[name="template"]').data('codemirror').getValue(),
			result: $('[name="result"]').data('codemirror').getValue(),
			//data: parseOptions($('[name="data"]').data('codemirror').getValue()),
			//options: parseOptions($('[name="options"]').data('codemirror').getValue())
			data: $('[name="data"]').data('codemirror').getValue(),
			options: $('[name="options"]').data('codemirror').getValue(),
			mode: $('[name="template"]').siblings('.mode').val()
		};
		//$('.unitTest').text( JSON.stringify(t) );
		CodeMirror.runMode(JSON.stringify(t), {name:'javascript',json:true},$('.unitTest')[0]);
		//runTest(t);
    }

    function init(tests){
        var t,i,
			codeMirrorOptions = {
				lineNumbers:true,
				onKeyEvent: function(editor,event){
					if(event.type=='keyup'){updateCurrentTest();}
				}
			};

        if(tests.length){
            t = tests[tests.length-1]; //show last unit test
            $('[name="template"]')
				.val(t.template)
				.codemirror(codeMirrorOptions)
				.siblings('.mode')
					.val(t.mode)
					.trigger('keyup');
            $('[name="result"]')
				.val(t.result)
				.codemirror(codeMirrorOptions)
				.siblings('.mode')
					.val(t.mode)
					.trigger('keyup');
            $('[name="options"]')
				.val((t.options))
				.codemirror(codeMirrorOptions);
			$('[name="data"]')
				.val((t.data))
				.codemirror(codeMirrorOptions);
        }

		test( "full test", function() {
			for(i=0; i<tests.length; i++){
				runTest(tests[i]);
			}
		});



        updateCurrentTest();
    }

	function runTest(test){
		var mask = Mask.t(test.template,evl(test.options)),
			out = mask.render(evl(test.data));
		console.log(mtest=mask);
		equal(out,test.result,test.name);
	}

    function evl(str){
        return eval('(' + str + ')');
    }
	// formatJson() :: formats and indents JSON string
	// from http://ketanjetty.com/coldfusion/javascript/format-json/
	function formatJson(a){var b="";var c=a;var d=0;var e=c.length;var f="  ";var g="\n";var h="";for(var i=0;i<e;i++){h=c.substring(i,i+1);if(h=="}"||h=="]"){b=b+g;d=d-1;for(var j=0;j<d;j++){b=b+f}}b=b+h;if(h=="{"||h=="["||h==","){b=b+g;if(h=="{"||h=="["){d=d+1}for(var k=0;k<d;k++){b=b+f}}}return b}
})(jQuery);

/*
 [
 {"name":"test","template":"<!--defMarker/-->\n<!--dynMarker/-->\n<ul class=\"{{ top }}\">\n <!--item-->\n <li class=\"{{itemClass}}\">{{i}}: {{itemName}} - the {{i}} is rendered twice</li>\n {{unusedMarkerWillDisappear}}\n <!--/item-->\n</ul>","result":"I'm not given in the data object!\nI'm rendered dynamically by a function!\n<ul class=\"\">\n <li class=\"li\">0: list element - the 0 is rendered twice</li>\n <li class=\"li extra class\">1: another list element - the 1 is rendered twice</li>\n</ul>","data":{"listClass":"ul","itemClass":"li","item":[{"itemName":"list element"},{"itemClass":"li extra class","itemName":"another list element"}],"unusedData":"???"},"options":{"pattern":["{{%s%id%s}}","{{%s%id%s:%tmp%s}}","<!--%s%id%s/-->","<!--%s%id%s-->%tmp<!--%s/%id%s-->"],"cache":false,"marker":{"defMarker":"I'm not given in the data object!"}}},
 {"name":"test","template":"<!--defMarker/-->\n<!--dynMarker/-->\n<ul class=\"{{ top }}\">\n <!--item-->\n <li class=\"{{itemClass}}\">{{i}}: {{itemName}} - the {{i}} is rendered twice</li>\n {{unusedMarkerWillDisappear}}\n <!--/item-->\n</ul>","result":"I'm not given in the data object!\nI'm rendered dynamically by a function!\n<ul class=\"\">\n <li class=\"li\">0: list element - the 0 is rendered twice</li>\n <li class=\"li extra class\">1: another list element - the 1 is rendered twice</li>\n</ul>","data":"{\n  pattern:['{{%s%id%s}}','{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],\n  cache:false,\n  marker:{\n    defMarker:\"I'm not given in the data object!\",\n    dynMarker:function(){return \"I'm rendered dynamically by a function!\";}\n  }\n}","options":"{\n\t\tpattern:['{{%s%id%s}}','{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],\n\t\tcache:false,\n\t\tmarker:{\n\t\t\tdefMarker:\"I'm not given in the data object!\",\n\t\t\tdynMarker:function(){return \"I'm rendered dynamically by a function!\";}\n\t\t}\n\t}"}

 ]
*/