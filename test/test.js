(function($){
	var BASE = 'http://local.maskjs/test/';
	CodeMirror.modeURL = BASE +"vendor/CodeMirror2/mode/%N/%N.js";
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
		jQuery.getJSON(BASE + 'tests.json',{},init);
    });

	jQuery.fn.codemirror = function(options){
		return this.each(function(){$(this).data('codemirror',CodeMirror.fromTextArea(this, options || {}));});
	}



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

	function init(tests, status,request){
		$('[name="template"],[name="result"],[name="options"],[name="data"]').codemirror({
			lineNumbers:true,
			onKeyEvent: function(editor,event){
				if(event.type=='keyup'){updateCurrentTest();}
			},
			smartIndent:false
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
		module('maskJS')
		test(this.url, function() {
			for(var i=0; i<tests.length; i++){
				runTest(tests[i]);
			}
		});
		$('#log').click(function(){
			asyncTest('current test',1,function(){
					runTest(getCurrentTest(),true);
					start();
			});
		});
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
			console.log('# Mask\n',lmask = mask);
			console.log('# Tokenizer\n',ltokenizer = mask.tokenizer);
			console.log('# Parser\n',JSON.stringify(mask.tokenizer.parser));
			console.log('# Captures\n',JSON.stringify(mask.tokenizer.captures));
			console.log('# Result\n',(lresult = out));
		}
		equal(out,test.result,test.name);
	}

    function evl(str){
        return eval('(' + str + ')');
    }
})(jQuery);

/*
 [
 {"name":"test","template":"<!--defMarker/-->\n<!--dynMarker/-->\n<ul class=\"{{ top }}\">\n <!--item-->\n <li class=\"{{itemClass}}\">{{i}}: {{itemName}} - the {{i}} is rendered twice</li>\n {{unusedMarkerWillDisappear}}\n <!--/item-->\n</ul>","result":"I'm not given in the data object!\nI'm rendered dynamically by a function!\n<ul class=\"\">\n <li class=\"li\">0: list element - the 0 is rendered twice</li>\n <li class=\"li extra class\">1: another list element - the 1 is rendered twice</li>\n</ul>","data":{"listClass":"ul","itemClass":"li","item":[{"itemName":"list element"},{"itemClass":"li extra class","itemName":"another list element"}],"unusedData":"???"},"options":{"pattern":["{{%s%id%s}}","{{%s%id%s:%tmp%s}}","<!--%s%id%s/-->","<!--%s%id%s-->%tmp<!--%s/%id%s-->"],"cache":false,"marker":{"defMarker":"I'm not given in the data object!"}}},
 {"name":"test","template":"<!--defMarker/-->\n<!--dynMarker/-->\n<ul class=\"{{ top }}\">\n <!--item-->\n <li class=\"{{itemClass}}\">{{i}}: {{itemName}} - the {{i}} is rendered twice</li>\n {{unusedMarkerWillDisappear}}\n <!--/item-->\n</ul>","result":"I'm not given in the data object!\nI'm rendered dynamically by a function!\n<ul class=\"\">\n <li class=\"li\">0: list element - the 0 is rendered twice</li>\n <li class=\"li extra class\">1: another list element - the 1 is rendered twice</li>\n</ul>","data":"{\n  pattern:['{{%s%id%s}}','{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],\n  cache:false,\n  marker:{\n    defMarker:\"I'm not given in the data object!\",\n    dynMarker:function(){return \"I'm rendered dynamically by a function!\";}\n  }\n}","options":"{\n\t\tpattern:['{{%s%id%s}}','{{%s%id%s:%tmp%s}}', '<!--%s%id%s/-->', '<!--%s%id%s-->%tmp<!--%s/%id%s-->'],\n\t\tcache:false,\n\t\tmarker:{\n\t\t\tdefMarker:\"I'm not given in the data object!\",\n\t\t\tdynMarker:function(){return \"I'm rendered dynamically by a function!\";}\n\t\t}\n\t}"}

 ]
*/