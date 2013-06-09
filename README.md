# create-dependency-stream

## Synopsis

```javascript
var createDependencyStream = require('create-dependency-stream')
var pkgJSON = require('./package.json'); 
var stream = createDependencyStream(pkgJSON, {
  registry: 'http://registry.npmjs.org' // optional
});

stream.on('data', console.log);
/* emits dependency objects like: */
{ name: 'request',
  versionRange: '2.x',
  version: '2.21.0',
  package: { /* .. parsed package.json contents .. */ },
  parent: { /* .. dependency object that included this dependency .. */ }
  dependencies: { /* .. mapping from dependency names to dependency object .. */ }
}
```

## Description

Given a parsed package.json with dependencies, this will create a stream of
"dependency objects" containing the fully resolved versions and corresponding
package.json contents for every dependency and every child dependency, in a way
that (should be) completely compatible with npm.

## License

MIT
