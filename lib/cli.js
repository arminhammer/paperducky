#!/usr/bin/env node

'use strict';
var cli = require('commander');
var pd = require('./index');
var pkg = require('../package.json');
var P = require('bluebird');
var fs = P.promisifyAll(require('fs-extra'));
var path = require('path');
var AWS = require('aws-sdk');
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
      .then(function(newConfig) {
        //this.config = config;
        this.configDiff = { resources: {}};
        this.configDiff.resources[name] = newConfig;
        //pd.warning(JSON.stringify(this.configDiff));
        return pd.setConfig(CONFIG_FILE, this.configDiff);
      })
      .then(function(mainConfig) {
        //pd.error(JSON.stringify(mainConfig));
        this.config = mainConfig;
        return fs.readJsonAsync(name + '/resource.json');
      })
      .then(function(resource) {
        var templateDiff = { Resources: {}, Mappings: {Config:{}}};
        _.each(this.config.resources, function(res) {
          templateDiff.Mappings.Config[name] = res;
        });
        templateDiff.Resources[name] = resource;
        _.each(templateDiff.Resources[name].Properties, function(prop,key) {
          pd.warning(key);
          templateDiff.Resources[name].Properties[key] = { "Fn::FindInMap" : [ "Config", name, key ]};
        //var oldValue = resource.Properties[prop['Ref']]['Ref'];
        //resource.Properties[prop['Ref']]['Ref'] = name + 'Parameter' + oldValue;
        });
        pd.error(JSON.stringify(templateDiff));
        return pd.setConfig(CONFIG_TEMPLATE, templateDiff);
      })
      /*
        var newResource = { Resources: {}, Parameters: {}};
        _.each(resource.Properties, function(prop) {
          var oldValue = resource.Properties[prop['Ref']]['Ref'];
          resource.Properties[prop['Ref']]['Ref'] = name + 'Parameter' + oldValue;
        });
        newResource.Resources[name] = resource;
        newResource.Parameters[name] = this.config;
        pd.warning(JSON.stringify(newResource));
        pd.warning(JSON.stringify(CONFIG_TEMPLATE));
        return pd.setConfig(CONFIG_TEMPLATE, newResource);
      */
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
  .action(function(name) {
    pd.info('Deploying...');
    pd
      .getConfig(CONFIG_FILE, 'region')
      .bind({})
      .then(function(region) {
        AWS.config.region = region;
        this.cf = P.promisifyAll(new AWS.CloudFormation());
      })
      .then(function() {
        return fs.readJsonAsync(CONFIG_TEMPLATE)
      })
      .then(function(template) {
        return this.cf.createStackAsync({
          StackName: name,
          TemplateBody: JSON.stringify(template)
        })
      })
      .then(function(data) {
        pd.info('Stack ' + name + ' deployed at ' + data.StackId);
      })
      .catch(function(e) {
        pd.error(e);
      });
  });

cli
  .command('delete <name>')
  .description('delete a stack')
  .action(function(name) {
    pd.info('Deleting' + name + '...');
    pd
      .getConfig(CONFIG_FILE, 'region')
      .bind({})
      .then(function(region) {
        AWS.config.region = region;
        this.cf = P.promisifyAll(new AWS.CloudFormation());
      })
      .then(function(template) {
        return this.cf.deleteStackAsync({
          StackName: name,
        })
      })
      .then(function(data) {
        pd.info('Stack ' + name + ' deleted.');
      })
      .catch(function(e) {
        pd.error(e);
      });
  });

cli
  .parse(process.argv);
