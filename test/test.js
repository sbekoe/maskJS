(function($){
	CodeMirror.modeURL = "vendor/CodeMirror2/mode/%N/%N.js";
    $(function(){
        $('.test textarea').keyup(updateCurrentTest);

		//change mode
		$('#mode').keyup(function(){
			var editorT = $('.test [name="template"]').data('codemirror'),
				editorR = $('.test [name="result"]').data('codemirror'),
				mode = $(this).val();
			editorT.setOption("mode", mode);
			CodeMirror.autoLoadMode(editorT, mode);
			editorR.setOption("mode", mode);
			CodeMirror.autoLoadMode(editorR, mode);
			updateCurrentTest();
		});
    });

	jQuery.fn.codemirror = function(options){
		return this.each(function(){$(this).data('codemirror',CodeMirror.fromTextArea(this, options || {}));});
	}

	jQuery.getJSON('tests.json',{},init);

	function getCurrentTest(){
		return {
			name:$('#name').val(),
			template: $('[name="template"]').data('codemirror').getValue(),
			result: $('[name="result"]').data('codemirror').getValue(),
			data: $('[name="data"]').data('codemirror').getValue(),
			options: $('[name="options"]').data('codemirror').getValue(),
			mode: $('#mode').val()
		};
	}

    function updateCurrentTest(){
		CodeMirror.runMode(JSON.stringify(getCurrentTest()), {name:'javascript',json:true},$('.unitTest')[0]);
		$('.test .banner').removeClass('fail pass');
    }

	function init(tests){
		$('[name="template"],[name="result"],[name="options"],[name="data"]').codemirror({
			lineNumbers:true,
			onKeyEvent: function(editor,event){
				if(event.type=='keyup'){updateCurrentTest();}
			}
		});
		if(tests.length){
			load(tests[tests.length-1]);
		}
		for(var i=0;i<tests.length;i++){
			$('#tests').append('<option'+ (i==tests.length-1? ' selected="selected"' : '') +'>' + tests[i].name + '</option>');
		}

		$('#tests').change(function(){
			for(var i=0;i<tests.length;i++){
				if(tests[i].name===this.value) {load(tests[i])};
			}
		}).trigger('change');

		test( "loaded tests", function() {
			for(var i=0; i<tests.length; i++){
				runTest(tests[i]);
			}
		});
		/*
		asyncTest('current test',1,function(){
			$('#log').click(function(){
				ok(true,'test');
				//console.log(getCurrentTest());
				//runTest(getCurrentTest());
				start();
			});
		});
		//*/
		$('#log').click(function(){ runTest(getCurrentTest(),true); });
	}

    function load(test){
		$('[name="template"],[name="result"],[name="options"],[name="data"]').each(function(){
			$(this).data('codemirror').setValue(test[$(this).attr('name')]);
		});
		$('#mode').val(test.mode).trigger('keyup');
		$('#name').val(test.name);
        updateCurrentTest();
    }


	function runTest(test,log){
		var mask = Mask.t(test.template,evl(test.options)),
			out = mask.render(evl(test.data)),
			success = out==test.result;
		if(log){
			$('.test .banner')
				.toggleClass('pass',success)
				.toggleClass('fail',!success);
			console.log('### log current unit test ###');
			console.log(lmask = mask);
			console.log(ltokenizer = mask.tokenizer);
			console.log(lresult = out);
		}
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