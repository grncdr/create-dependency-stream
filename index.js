var path        = require('path');
var npm         = require('npm');
var map         = require('map-stream');
var mergeStream = require('merge-stream');
var combine     = require('stream-combiner');
var defined     = require('defined');

var packageToDependencyStream = require('package-to-dependency-stream');

module.exports = createDependencyStream

function createDependencyStream(rootJSON, opts, parentDep) {
  opts = opts || {};
  opts.loglevel = defined(opts.loglevel, 'silent');

  var pipeline = combine(map(getPackage), map(maybeRecur));

  var out = mergeStream();

  var cacheRead;

  npm.load(opts, function () {
    cacheRead = npm.commands.cache.read;
    out.add(packageToDependencyStream(rootJSON).pipe(pipeline));
  });

  return out;

  function getPackage(dep, callback) {
    cacheRead(dep.name, dep.versionRange, function (err, pkgJSON) {
      if (err) return callback(err);
      dep['package'] = pkgJSON;
      dep.version    = pkgJSON.version;
      dep.parent     = parentDep;
      dep.cacheDir   = path.join(npm.config.root.cache, dep.name, dep.version);
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

  function recur(dep, callback) {
    dep.dependencies = {};
    out.add(
      createDependencyStream(dep['package'], opts, dep)
      .on('data', function (child) {
        dep.dependencies[child.name] = child;
      })
      .on('error', callback)
      .on('end', function () {
        callback(null, dep)
      })
    )
  }
}

// manual little self-test
if (module === require.main) {
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
      parents.unshift(pd.name)
    }
    parents.unshift(pkg.name);
    console.log(
      "%s@%s [required by %s]",
      dependency.name,
      dependency.version,
      parents.join('->')
    );
  })
}
