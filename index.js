//var Stream      = require('stream');
Error.stackTraceLimit = 40;

var npm         = require('npm');
var map         = require('map-stream');
var mergeStream = require('merge-stream');
var combine     = require('stream-combiner');
var defined     = require('defined');

var packageToDependencyStream = require('package-to-dependency-stream');

module.exports = createDependencyStream


function createDependencyStream(pkgJSON, opts) {
  opts = opts || {};
  opts.registry = defined(
    // pkgJSON.registry,  Maybe?
    opts.registry,
    'http://registry.npmjs.org'
  );

  var read = npm.commands.cache.read;

  var pipeline = combine(
    map(getPackageJson),
    map(maybeRecur)
  );

  var out = mergeStream();

  out.add(packageToDependencyStream(pkgJSON).pipe(pipeline));

  return out;

  function getPackageJson(dep, callback) {
    read(dep.name, dep.versionRange, function (err, pkgJSON) {
      if (err) return callback(err);
      dep['package'] = pkgJSON;
      dep.version = pkgJSON.version;
      callback(null, dep);
    });
  }

  function maybeRecur(dep, callback) {
    var pkg = dep['package'];
    if (pkg && pkg.dependencies && !dep.dependencies) {
      recur(dep, callback)
    }
    // otherwise emit to output immediately
    else {
      callback(null, dep)
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
if (module === require.main) {
  npm.load({loglevel: 'silent'}, function () {
    var pkg = {
      name: 'my-pkg',
      version: '1.0.0',
      dependencies: {
        'request': 'latest',
        'express': 'latest'
      }
    };
    createDependencyStream(pkg).on('data', function (dependency) {
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
  })
}
