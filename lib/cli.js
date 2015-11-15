#!/usr/bin/env node

'use strict';
var cli = require('commander');
var pd = require('./index');
var pkg = require('../package.json');
var P = require('bluebird');
var fs = P.promisifyAll(require('fs-extra'));
var path = require('path');
var AWS = require('aws-sdk');
//var ec2 = P.promisifyAll(new AWS.EC2());
var cf = P.promisifyAll(new AWS.CloudFormation());
var prompt = P.promisifyAll(require('prompt'));

var CONFIG_DIR = './.paperducky/';
var CONFIG_FILE = CONFIG_DIR + 'config.json';
var CONFIG_TEMPLATE = CONFIG_DIR + 'template.json';

var processBasePath = path.resolve(path.dirname(process.argv[1]),'../lib/node_modules/paperducky');

cli
  .version(pkg.version);

cli
  .command('init')
  .option('-r, --region <region>', 'Set region')
  .description('initializes in the current directory')
  .action(function(cmd) {

    pd.info('Initializing...');
    //console.log(cmd);
    cmd.config = {};
    if(cmd.region) {
      cmd.config.region = cmd.region;
    } else {
      var awsConfig = new AWS.Config();
      if(awsConfig.region) {
        cmd.config.region = awsConfig.region;
      }
    }

    prompt
      .addPropertiesAsync(cmd.config, [{
        name: 'region',
        default: 'us-west-2',
        description: 'Enter region',
        type: 'string',
        pattern: /^us-east-1|us-west-1|us-west-2|eu-west-1|eu-central-1|ap-southeast-1|ap-southeast-2|ap-northeast-1|sa-east-1$/
      }])
      .then(function(e) {
        pd.info('Using region ' + e.region);
      })
      .catch(function(e) {
        pd.error('Using region ' + e.region);
      })
      .then(function() {
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
                  .createReadStream(processBasePath + '/resources/config.default.json')
                  .pipe(fs.createWriteStream(CONFIG_FILE));
                fs
                  .createReadStream(processBasePath + '/resources/template.default.json')
                  .pipe(fs.createWriteStream(CONFIG_TEMPLATE));
                return pd.setConfig(CONFIG_FILE, cmd.config)
                  .catch(function(e) {
                    pd.error('ERROR');
                    console.log(e);
                  });
              });
          });
      })
      .finally(function() {
        pd.info('Project Initialized.');
      });


  });

cli
  .command('add <resource> <name>')
  .description('add a new resource to the environment')
  .action(function(resource, name) {
    fs.copyAsync(processBasePath + '/resources/' + resource, name)
      .then(function() {
        pd.info('Adding ' + resource + ' with name ' + name);
      })
      .catch(function(e) {
        pd.error(e);
      });
  });

cli
  .command('validate')
  .description('validate environment')
  .action(function() {
    fs
      .readJSONAsync(CONFIG_TEMPLATE)
      .then(function(body) {
        pd
          .getConfig(CONFIG_FILE, 'region')
          .then(function(region) {
            console.log('Got region');
            console.log(region);
          })
          .then(function() {
            cf
              .validateTemplateAsync({
                TemplateBody: JSON.stringify(body)
              })
              .then(function() {
                pd.info('Template validated.');
              })
              .catch(function(e) {
                pd.error(e);
              })
          });
      });
  });

cli
  .command('deploy <name>')
  .description('deploy to a stack')
  .action(function() {

  });

cli
  .parse(process.argv);
