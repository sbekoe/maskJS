# API
## Setup the Language
### Defining the Syntax
´´´javascript
var mask = new Mask({
  // [...]
  
  syntax: {
    "mustache":  {
      pattern: '{{ ? }}|{{ / ?closer }}',
      trimBlockEnds: true
      // generator: function(){}
    },
  }
  
  // [...]
});
´´´
Special chars in the syntax pattern:
- `?` literal is a placeholder for the logic part. A plain `?` means, that any defined logic can take place. To allow only a selection list them in the way `?path?if?switch`.
- `|` seperates the block parts in the pattern. The literal practialy represents the content between two block boundaries in the posterior template.
- ` ` (only a singele white space char) will replaced by `[ \\t]*` in the lexers expression. So in the example above `{{block}}Content ... {{/block}}` would match the patter just as `{{ block }} Content ... {{ /block }}`.

### Defining Logic
´´´javascript
var mask = new Mask({
  // [...]
  
  logic:{
    "path": {
      pattern:'(#param:#namespace)'
      //priority:0
    },

    "condition":{
      pattern: "(#param:%ns)(?:(#param:==|!=|<|>|<=|>=)(#param:%ns))?\\?(#param:#namespace)(?:\\:(#param:%ns))?",
      translator: function(abstract, key){
        return "$.handle('" + abstract.token[0]['$namespace'] + "')";
      }
    }
  }
  
  // [...]
});
´´´
## Registering Templates
## Render Templates / Creating Views
### Features
* Automated organization of templates
  Each nested template is registered as independed template in the namespace of the parent template.
* resolving data paths/namespaces while rendering

# Examples
## Trivial
template
```mustache
{list}
list with 3 elements:
  {item}
{/list}
```
context
```
{
  list:{
    item:[
      '1: item a',
      '2: item b',
      '3: item c'
    ]
  }
}
```
output
```
list with 3 elements:
  1: item a
  2: item b
  3: item c
```

## Build in features
template
```
{list}
list with {item.length} elements:
  {item}{i++}: {text}{/item}
{/list}
```
context
```
{
  list:{
    item:[
      {text: 'item a'},
      {text: 'item b'},
      {text: 'item c'}
    ]
  }
}
```
would render the same output
