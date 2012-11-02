# API
## Setup
### Defining the Syntax
### Defining Logic
### Registering Templates
## Render Templates
### Features
* Automated organization of templates
  Each nested template is registered as independed template in the namespace of the parent template.
* resolving data paths/namespaces while rendering

# Examples
## Trivial
template
```
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
