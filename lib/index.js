'use strict';

var P = require('bluebird');
var fs = P.promisifyAll(require('fs-extra'));
var chalk = require('chalk');
var _ = require('lodash');

var i = chalk.green;
var e = chalk.bold.red;
var w = chalk.yellow;

function info(message) {
  console.log(i(message));
}

function warning(message) {
  console.log(w(message));
}

function error(message) {
  console.log(e(message));
}

function setConfig(file, val) {
  return fs
    .readJsonAsync(file)
    .then(function(body) {
      return _.merge(body, val, function(a, b) {
        if (_.isArray(a)) {
          return a.concat(b);
        }
      })
    })
    .then(function(newBody) {
      return fs
        .writeJsonAsync(file, newBody)
        .then(function() {
          info('Saved value');
          return newBody;
        })
        .catch(function(e) {
          error('Writing config file failed.');
          throw e;
        })
    })
    .catch(function(e) {
      throw e
    });
}

function getConfig(file, val) {
  return fs
    .readJsonAsync(file)
    .then(function(body) {
      return body[val];
    })
}

var Paperducky = {

  info: info,
  warning: warning,
  error: error,
  setConfig: setConfig,
  getConfig: getConfig

};

module.exports = Paperducky;
