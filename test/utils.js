'use strict';

const assert = require('assert');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const globby = require('globby');
const execSync = require('child_process').execSync;
const spawnSync = require('child_process').spawnSync;
const existsSync = require('fs').existsSync;
const stableStringify = require('json-stable-stringify');

module.exports.mkdirp = mkdirp;

module.exports.pause = function (seconds) {
  spawnSync(
    'ping', [ '127.0.0.1',
      process.platform === 'win32' ? '-n' : '-c',
    (seconds + 1).toString()
  ]);
};

module.exports.vacuum = function () {
  throw new Error('Async vacuum not implemented');
};

module.exports.vacuum.sync = function (p) {
  const limit = 5;
  let hasError;
  for (let i = 0; i < limit; i += 1) {
    hasError = null;
    try {
      rimraf.sync(p);
    } catch (error) {
      hasError = error;
    }
    if (!hasError) break;
    if (i < limit - 1) {
      module.exports.pause(5);
    }
  }
  if (hasError) {
    throw hasError;
  }
};

module.exports.exec = function () {
  throw new Error('Async exec not implemented');
};

module.exports.exec.sync = function (command, opts) {

  const child = execSync(command, opts);
  return (child || '').toString();

};

module.exports.spawn = function () {
  throw new Error('Async spawn not implemented');
};

module.exports.spawn.sync = function (command, args, opts) {

  if (!opts) opts = {};
  opts = Object.assign({}, opts); // change own copy

  const d = opts.stdio;
  if (!d) {
    opts.stdio = [ 'pipe', 'pipe', 'inherit' ];
  } else
  if (typeof d === 'string') {
    opts.stdio = [ d, d, d ];
  }

  const expect = opts.expect || 0;
  delete opts.expect; // to avoid passing to spawnSync
  const opts2 = Object.assign({}, opts); // 0.12.x spoils
  const child = spawnSync(command, args, opts2);
  const s = child.status;

  if (child.error || (s !== expect)) {
    if (opts.stdio[1] === 'pipe' && child.stdout) {
      process.stdout.write(child.stdout);
    } else
    if (opts.stdio[2] === 'pipe' && child.stderr) {
      process.stdout.write(child.stderr);
    }
    console.log('> ' + command + ' ' + args.join(' '));
  }

  if (child.error) {
    throw child.error;
  }
  if (s !== expect) {
    throw new Error('Status ' + s.toString() +
      ', expected ' + expect.toString());
  }

  if ((opts.stdio[1] === 'pipe') &&
      (opts.stdio[2] === 'pipe')) {
    return {
      stdout: child.stdout.toString(),
      stderr: child.stderr.toString()
    };
  } else
  if (opts.stdio[1] === 'pipe') {
    return child.stdout.toString();
  } else
  if (opts.stdio[2] === 'pipe') {
    return child.stderr.toString();
  } else {
    return '';
  }

};

module.exports.pkg = function () {
  throw new Error('Async pkg not implemented');
};

const es5path = path.resolve(__dirname, '../lib-es5/bin.js');
const es7path = path.resolve(__dirname, '../lib/bin.js');

module.exports.pkg.sync = function (args, opts) {
  args = args.slice();
  const es5 = existsSync(es5path);
  const binPath = es5 ? es5path : es7path;
  args.unshift(binPath);
  if (!es5) args.unshift('-r', 'babel-register');
  if (Array.isArray(opts)) opts = { stdio: opts };
  try {
    const ss = module.exports.spawn.sync;
    return ss('node', args, opts);
  } catch (error) {
    console.log(`> ${error.message}`);
    process.exit(2);
  }
};

module.exports.stringify = function (obj, replacer, space) {
  return stableStringify(obj, { replacer, space });
};

module.exports.filesBefore = function (n) {
  for (const ni of n) {
    module.exports.vacuum.sync(ni);
  }
  const b = globby.sync('**/*', { nodir: true }).sort();
  return b;
};

module.exports.filesAfter = function (b, n) {
  const a = globby.sync('**/*', { nodir: true }).sort();
  for (const bi of b) {
    if (a.indexOf(bi) < 0) {
      assert(false, `${bi} disappeared!?`);
    }
  }
  const d = [];
  for (const ai of a) {
    if (b.indexOf(ai) < 0) {
      d.push(ai);
    }
  }
  assert(d.length === n.length, JSON.stringify([ d, n ]));
  for (const ni of n) {
    assert(d.indexOf(ni) >= 0, JSON.stringify([ d, n ]));
    module.exports.vacuum.sync(ni);
  }
};
