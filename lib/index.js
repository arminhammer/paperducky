'use strict';

var P = require('bluebird');
var fs = P.promisifyAll(require('fs'));
var chalk = require('chalk');
var i = chalk.green;
var e = chalk.bold.red;
var w = chalk.yellow;

function fsExists(path, type) {
  return fs
    .lstatAsync(path)
    .then(function(stats) {
      if (type === 'dir' && stats.isDirectory()) {
        return true;
      } else if (type === 'file' && stats.isFile()) {
        return true;
      } else {
        throw false;
      }
    })
    .catch(function() {
      throw false;
    });
}

function info(message) {
  console.log(i(message));
}

function warning(message) {
  console.log(w(message));
}

function error(message) {
  console.log(e(message));
}

var Paperducky = {

  fsExists: fsExists,
  info: info,
  warning: warning,
  error: error

};

module.exports = Paperducky;
