/**
 * Created with JetBrains PhpStorm.
 * User: Simon
 * Date: 13.10.12
 * Time: 12:33
 * To change this template use File | Settings | File Templates.
 */

module('Exp');
test('match obj extensions',function(){
  var exp, match;
  exp = Exp.s(/(unnamed) (#sub:foo) (#top:(#sub:bar))/,{
    captureName: true, // default
    captureIndices: true,
    capturePaths: true
  });
  match = exp.exec('unnamed foo bar');
  deepEqual(match, {
    0:'unnamed foo bar',
    1:'unnamed',
    2:'foo',
    3:'bar',
    4:'bar',
    'sub':['foo','bar'], // 'bar' will show up here also, because its capture has the same name
    'top':['bar'],
    'top_sub':['bar'], // path to the second #sub capture
    index:0,
    input:'unnamed foo bar',
    lastRange:[0,0],
    length: 5,
    match: "unnamed foo bar",
    range:[0,0]
  },'extend match with capture names, capture indices and capture paths');

  // only capture names
  exp = Exp.s(/(unnamed) (#sub:foo) (#top:(#sub:bar))/);
  match = exp.exec('unnamed foo bar');
  deepEqual(match, {
    'sub':['foo','bar'], // 'bar' will show up here also, because its capture has the same name
    'top':['bar'],
    index:0,
    input:'unnamed foo bar',
    lastRange:[0,0],
    length: 5,
    match: "unnamed foo bar",
    range:[0,0]
  },'extend match with with capture names only');
});

test('capturing & non-capturing',function(){
    var exp, match;
	exp = Exp.s(/(unnamed) (#capture:named) (unnamed)/,{
    captureIndices:true
  });
	match = exp.exec('unnamed named unnamed');
	deepEqual(match, {
    0:'unnamed named unnamed',
    1:'unnamed',
    2:'named',
    3:'unnamed',
    capture:['named'],
    index:0,
    input:'unnamed named unnamed',
    lastRange:[0,0],
    length: 4,
    match: "unnamed named unnamed",
    range:[0,0]
  },'provide native unnamed captures');
	equal(match.capture[0], 'named');

    exp = Exp.s(/(unnamed) (#capture:named) (?:nonCaptured) (unnamed)/,{
      captureIndices:true
    });
    match = exp.exec('unnamed named nonCaptured unnamed');
    ok(
      match[0] == 'unnamed named nonCaptured unnamed' &&
      match[1] == 'unnamed' &&
      match[2] == 'named' &&
      match.capture == 'named' &&
      match[3] == 'unnamed',
      'support of non-capturing parentheses'
    );
});

test("nested captures and wildcards",function(){
	var exp = new Exp('name is #name',{
    wildcards:{
      name: '#firstName #lastName',
      firstName:'%w',
      lastName:'%w',
      w:'\\w+'
    },
    capturePaths:true
  });
	var match = exp.exec('My name is Ted Mosby!');

	equal(match.match, 'name is Ted Mosby', 'matched string');
	equal(match.name , 'Ted Mosby', 'named capture');
	ok(match.name_firstName =='Ted' && match.name_lastName == 'Mosby', 'named nested captures');
});


test("multiple use of capture name",function(){
	var exp = new Exp({
		source: '#number',
		wildcards:{
			number: '#cypher#cypher#cypher',
			cypher:'\\d'
		}
	});
	var match = exp.exec('123456');

	ok(match.match == '123', 'whole match');
	deepEqual(match.cypher,['1','2','3'],'');
});


test("disjunction",function(){
	var exp = new Exp('#subject #verb #predicate[%marks]',{wildcards:{
		subject: '\\w+',
		verb: '\\w+',
		predicate: ['easy to use','ingenious', 'helpful'], // disjunction
		marks:Exp.esc('.!?') // punctuation marks (escape native regexp chars)
	}});

	ok(exp.test('expJS is easy to use!'));
	ok(exp.test('expJS is ingenious?'));
	ok(exp.test('expJS is helpful.'));
});

// TODO new example is necessary since < and > are replaced by # and %
test("escaping of special chars '%' and '#'",function(){
	var e = /<%s#tagname id%s=%s"#id"%s>#text<\/#w>/g,
		exp = new Exp(e,{wildcards:{
			tagname: '\\w+',
			text: '.*',
			id: '\\w+',
			s: '\\s*',
			w: '\\w+'
		}});

	var match = exp.exec('[...] <div id="content">text</div> [...]');
	ok(match,e.source + " to " + exp._exp.source);
	deepEqual([match.id[0],match.text[0]],['content','text']);
});


test("scanning, mapping and skipping",function(){
	var exp = new Exp(/#tag/g,{
		source: '#tag',
    capturePaths: true,
		wildcards:{
			// Captures like #name will be stored in match.$tag_name
			// Here the %name will include the same expression like #expression but without capturing its match.
			"tag": /< #name\ id = "#id" >#content< \/%name >/,

			// The expression assigned to a keyword can hold further injections and captures.
			// So the keywords are resolved recursive (since version 0.4).
			// If an keywords expression contains itslefs, an error event is thrown.
			"name": "%w",

			"id": "%w",
			"content": ".*",

			// a keywords first character can be the injetion or capture prefix "%"/"#".
			// In this case, it's allowd to use the keyword in expressions without prefixing it.
			// So in this example a whitespace respresents the expression \\s* => higher readability with
			// the drawback of meaningull whitespace.
			"% ": "\\s*",
			"w": "\\w+"
		}
	});

	var tokens = exp.scan(
		'<div id = "header" > header text< /div >\n' +
		'<div id = "skip" > header text< /div >\n' +
		'<div id =    "content">content text</div>\n' +
		'<div id="footer">footer text</div>\n',
		function(match){
			return match.tag_id == 'skip'? Exp.skipper : 'tagname: '+ match.tag_name + ', id: ' + match.tag_id + ', content: ' + match.tag_content;
		});

	deepEqual(tokens,[
		"tagname: div, id: header, content:  header text",
		"tagname: div, id: content, content: content text",
		"tagname: div, id: footer, content: footer text"
	]);
});

test('named inline captures',function(){
	var phone = Exp.s(/(#countrycode:\d+) (#areacode:%number) (#number:(?:\d+))/,{wildcards:{"areacode":/\d{4}/, number:/\d+/}}).exec('001 234 56789');
	equal(phone.countrycode, '001');
	equal(phone.areacode, '234');
	equal(phone.number, '56789');
});



test('assignments',function(){
	// inline assignments
	exp = Exp.s(/(#person:Homer|Marge|Bart|Lisa|Maggie)>simpsons/g,{
		assignments:{
			"simpsons":{
				Homer: {age:42, gender:'m'},
				Marge: {age:34, gender:'w'},
				Bart: {age:10, gender:'m'},
				Lisa: {age:8, gender:'w'},
				Maggie: {age:1, gender:'w'}
			}
		}
	});

	deepEqual(
		exp.scan('Homer, Marge, Bart, Lisa, Maggie',function(match){
			return {age: match.age, gender: match.gender};
		}),
		[
			{age:42, gender:'m'},
			{age:34, gender:'w'},
			{age:10, gender:'m'},
			{age:8, gender:'w'},
			{age:1, gender:'w'}
		],
		'inline assignments selected by captured string'
	);

  var
    e = Exp.s(/(#c1:\d)>a1(#c2:\d)>a2(#c3:\d)>a3/,{assignments:{
      a1: {attr1:'test1'},
      a2: {attr2:'test2'},
      a3: {attr3:'test3'}
    }}),
    match = e.exec('123')

  deepEqual(
    [match.attr1, match.attr2, match.attr3],
    ['test1', 'test2', 'test3'],
    'multiple assignments'
  );

  var
    e = Exp.s(/(#c1:\d)>a1(#c2:\d)>>a2(#c3:\d)>a3/,{assignments:{
      a1: {attr1:'test1'},
      a2: {
        attr1:'forced',
        attr2:'test2'
      },
      a3: {
        attr1:'test3',
        attr3:'test3'
      }
    }}),
    match = e.exec('123')

  deepEqual(
    [match.attr1, match.attr2, match.attr3],
    ['forced', 'test2', 'test3'],
    'soft & forced match extension'
  );

});

test('repetitions', function(){
  var e,m;
    e = Exp.s(/(#list:(#number:\d))*$/,{
      captureRepetition: true
    });

    m = e.exec('0123');
//  ok(match.number[0] == 0 && match.number[1] == 1 && match.number[2] == 2 && match.number[3] == 3);
  deepEqual(
    [
      m.list[0][0].number[0],
      m.list[0][1].number[0],
      m.list[0][2].number[0],
      m.list[0][3].number[0]
    ],
    ['0','1','2','3'],
    'repetition of a named inline capture'
  );

    e = Exp.s(/((#number:\d))*$/,{
      captureRepetition: true,
      captureIndices:true
    });

    m = e.exec('0123');
//  ok(match.number[0] == 0 && match.number[1] == 1 && match.number[2] == 2 && match.number[3] == 3);
  deepEqual(
    [
      m[1][0].number[0],
      m[1][1].number[0],
      m[1][2].number[0],
      m[1][3].number[0]
    ],
    ['0','1','2','3'],
    'repetition of a named capture'
  );

  e = Exp.s(/(#number:\d){0,, }$/,{
    captureRepetition: true
  });
  m = e.exec('0 1 2 3');
  deepEqual(
    [
      m.number[0][0].match,
      m.number[0][1].match,
      m.number[0][2].match,
      m.number[0][3].match,
    ],
    ['0','1','2','3'],
    'separated repetitions'
  );

  e = Exp.s(/(#number:\d){0, }$/,{
    captureRepetition: true
  });
  m = e.exec('0 1 2 3');
  equal(m.match,'', '0 separated repetitions');

  // repetition of named capture defined in wildcards
  e = Exp.s(/#number{0,, }/,{
    captureRepetition: true,
    wildcards:{
      'number': /\d/
    }
  });
  m = e.exec('0 1 2 3');
  deepEqual(
    [
      m.number[0][0].match,
      m.number[0][1].match,
      m.number[0][2].match,
      m.number[0][3].match,
    ],
    ['0','1','2','3'],
    'separated repetitions'
  );
});
//test('escaping Exp.esc',function(){});
//test('expanding external source string Exp.expand',function(){});
