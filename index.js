var Stream      = require('stream');
Error.stackTraceLimit = 40;

var map         = require('map-stream');
var mergeStream = require('merge-stream');
var combine     = require('stream-combiner');
var defined     = require('defined');

var packageToDependencyStream = require('package-to-dependency-stream');
var resolvePackageVersions    = require('resolve-package-versions');
var getPackageJSONs           = require('get-package-jsons');

module.exports = createDependencyStream

function createDependencyStream(pkgJSON, opts) {
  opts = opts || {};
  opts.registry = defined(
    // pkgJSON.registry,  Maybe?
    opts.registry,
    'http://registry.npmjs.org'
  );

  var pipeline = combine(
    resolvePackageVersions(opts),
    getPackageJSONs(opts),
    map(maybeRecur)
  );

  var out = mergeStream();

  out.add(packageToDependencyStream(pkgJSON).pipe(pipeline));

  return out;

  function maybeRecur(dependency, callback) {
    var pkg = dependency['package'];
    if (pkg && pkg.dependencies && !dependency.dependencies) {
      recur(dependency, callback)
    }
    // otherwise emit to output immediately
    else {
      callback(null, dependency)
    }
  }

  function recur(dependency, callback) {
    dependency.dependencies = {};
    out.add(
      createDependencyStream(dependency['package'], opts)
      .on('data', function (child) {
        dependency.dependencies[child.name] = child;
      })
      .on('error', callback)
      .on('end', function () {
        callback(null, dependency)
      })
    )
  }

}

// manual little self-test
if (module === require.main)
  (function () {
    var pkg = {
      name: 'my-pkg',
      version: '1.0.0',
      dependencies: {
        'request': 'latest',
        'express': 'latest'
      }
    };
    createDependencyStream(pkg)
      .on('data', function (dependency) {
        var parents = [];
        var pd = dependency;
        while ((pd = pd.parent)) {
          parents.push(pd.name)
        }
        parents.push(pkg.name)
        console.log(
          "%s@%s [required by %s]",
          dependency.name,
          dependency.version,
          parents.join('->')
        );
      })
  })()
