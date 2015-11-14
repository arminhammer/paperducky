#!/usr/bin/env node

'use strict';
var cli = require('commander');
var pd = require('./index');
var pkg = require('../package.json');
var P = require('bluebird');
var fs = P.promisifyAll(require('fs'));

var CONFIG_DIR = '.paperducky/';
var CONFIG_FILE = CONFIG_DIR + 'paperducky.json';

cli
  .version(pkg.version);

cli
  .command('init')
  .description('initializes in the current directory')
  .action(function() {
    pd.info('Initializing...');
    pd.info('Creating configuration folder...');
    pd
      .fsExists(CONFIG_DIR, 'dir')
      .then(function() {
        pd.warning(CONFIG_DIR + 'exists, Skipping.');
      })
      .catch(function() {
        return fs.mkdirAsync(CONFIG_DIR);
      })
      .then(function() {
        pd.info('Creating configuration file...');
        return pd.fsExists(CONFIG_FILE, 'file')
          .then(function() {
            pd.warning(CONFIG_FILE + ' exists, Skipping.');
          })
          .catch(function() {
            fs
              .createReadStream('./resources/paperducky.default.json')
              .pipe(fs.createWriteStream(CONFIG_FILE));
          });
      })
      .finally(function() {
        pd.info('Project Initialized.');
      });
  });

cli
  .parse(process.argv);
