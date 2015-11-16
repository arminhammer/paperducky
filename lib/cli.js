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
var prompt = P.promisifyAll(require('prompt'));
var _ = require('lodash');

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
        default: 'us-east-1',
        description: 'Enter region',
        type: 'string',
        pattern: /^us-east-1|us-west-1|us-west-2|eu-west-1|eu-central-1|ap-southeast-1|ap-southeast-2|ap-northeast-1|sa-east-1$/
      }])
      .then(function(e) {
        pd.info('Using region ' + e.region);
      })
      .then(function() {
        pd.info('Creating configuration folder...');
      })
      .then(function() {
        return fs.ensureDirAsync(CONFIG_DIR)
      })
      .then(function() {
        pd.info('Creating configuration file...')
      })
      .then(function() {
        return fs.copyAsync(processBasePath + '/resources/config.default.json', CONFIG_FILE)
      })
      .then(function() {
        return pd.setConfig(CONFIG_FILE, cmd.config)
      })
      .then(function() {
        pd.info('Creating template file...')
      })
      .then(function() {
        return fs.copyAsync(processBasePath + '/resources/template.default.json', CONFIG_TEMPLATE)
      })
      .then(function() {
        pd.info('Project Initialized.');
      })
      .catch(function(e) {
        pd.error(e);
      })
  });

cli
  .command('add <resource> <name>')
  .description('add a new resource to the environment')
  .action(function(resource, name) {
    fs
      .copyAsync(processBasePath + '/resources/' + resource, name)
      .then(function() {
        return fs.readJsonAsync(name + '/config.json');
      })
      .bind({})
      .then(function(config) {
        this.config = config;
        this.configDiff = { resources: {}};
        this.configDiff.resources[name] = config;
        pd.warning(JSON.stringify(this.configDiff));
        return pd.setConfig(CONFIG_FILE, this.configDiff);
      })
      .then(function() {
        return fs.readJsonAsync(name + '/resource.json');
      })
      .then(function(resource) {
        var newResource = { Resources: {}, Parameters: {}};
        pd.warning('Properties:');
        //pd.warning(JSON.stringify(resource));
        //pd.warning(JSON.stringify(resource.Properties['ImageId']));
        _.each(resource.Properties, function(prop) {
          //pd.warning(JSON.stringify(prop.Ref));
          //console.log(prop['Ref']);
          //pd.warning(resource.Properties[prop['Ref']]['Ref']);
          var oldValue = resource.Properties[prop['Ref']]['Ref']
          resource.Properties[prop['Ref']]['Ref'] = name + 'Parameter' + oldValue;
        });
        newResource.Resources[name] = resource;
        newResource.Parameters[name] = this.config;
        pd.warning(JSON.stringify(newResource));
        pd.warning(JSON.stringify(CONFIG_TEMPLATE));
        return pd.setConfig(CONFIG_TEMPLATE, newResource);
      })
      .then(function() {
        pd.info('Added ' + resource + ' with name ' + name);
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
            AWS.config.region = region;
            var cf = P.promisifyAll(new AWS.CloudFormation());
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
    pd.info('Deploying...');
  });

cli
  .parse(process.argv);
