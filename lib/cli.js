#!/usr/bin/env node

'use strict';
var cli = require('commander');
var paperducky = require('./');
var pkg = require('../package.json');

cli
  .version(pkg.version);

cli
  .command('init')
  .description('initializes in the current directory')
  .action(function () {
    console.log("Initialized.");
  });

cli
  .parse(process.argv);

console.log('Done.');
