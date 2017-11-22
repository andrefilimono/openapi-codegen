'use strict';

const fs = require('fs');
const util = require('util');

const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const mustache = require('mustache');
const clone = require('reftools/lib/clone.js').clone;

const adaptor = require('./adaptor.js');

const outputDir = './out/';

function main(o, config, configName) {
    let verbose = config.defaults.verbose;
    config.defaults.configName = configName;
    adaptor.transform(o, config.defaults, function(err, model) {
        for (let p in config.partials) {
            let partial = config.partials[p];
            if (verbose) console.log('Processing partial '+partial);
            config.partials[p] = fs.readFileSync('./templates/'+configName+'/'+partial,'utf8');
        }
    
        let actions = [];
        for (let t in config.transformations) {
            let tx = config.transformations[t];
            if (tx.input) {
                if (verbose) console.log('Processing template '+tx.input);
                tx.template = fs.readFileSync('./templates/'+configName+'/'+tx.input,'utf8');
            }
            actions.push(tx);
        }
    
        // TODO other backends, such as a stream writer for .tar.gz files
    
        if (verbose) console.log('Making/cleaning output directories');
        mkdirp(outputDir+configName,function(){
            rimraf(outputDir+configName+'/*',function(){
                if (config.directories) {
                    for (let directory of config.directories) {
                        mkdirp.sync(outputDir+configName+'/'+directory);
                    }
                }
                for (let action of actions) {
                    if (verbose) console.log('Rendering '+action.output);
                    let content = mustache.render(action.template, model, config.partials);
                    fs.writeFileSync(outputDir+configName+'/'+action.output,content,'utf8');
                }
                if (config.touch) {
                    let touchList = mustache.render(config.touch, model, config.partials);
                    let files = touchList.split('\r').join('').split('\n');
                    for (let file of files) {
                        file = file.trim();
                        if (file) {
                            if (!fs.existsSync(outputDir+configName+'/'+file)) {
                                fs.writeFileSync(outputDir+configName+'/'+file,'','utf8');
                            }
                        }
                    }
                }
                if (config.apache) {
                    fs.writeFileSync(outputDir+configName+'/LICENSE',fs.readFileSync('./templates/_common/LICENSE','utf8'),'utf8');
                }
                else {
                    fs.writeFileSync(outputDir+configName+'/LICENSE',fs.readFileSync('./templates/_common/UNLICENSE','utf8'),'utf8');
                }
                // TODO perApi
                // clone the model and provide an empty apis/operations/models container except for the item currently iterated
                let outer = model;
     
                if (config.perModel) {
                    let cModels = clone(model.models); 
                    for (let pm of config.perModel) {
                        for (let model of cModels) {
                            outer.models = [];
                            outer.models.push(model);
                            let filename = mustache.render(pm.output,outer,config.partials);
                            let template = fs.readFileSync('./templates/'+configName+'/'+pm.input,'utf8');
                            if (verbose) console.log('Rendering '+filename+' (dynamic)');
                            fs.writeFileSync(outputDir+configName+'/'+filename,mustache.render(template,outer,config.partials),'utf8');
                        }
                    }
                }
    
                if (config.perOperation) {
                    let cOperations = clone(model.operations);
                    for (let po of config.perOperation) {
                        for (let operation of cOperations) {
                            model.operations = [];
                            model.operations.push(operation);
                            let filename = mustache.render(po.output,outer,config.partials);
                            let template = fs.readFileSync('./templates/'+configName+'/'+po.input,'utf8');
                            if (verbose) console.log('Rendering '+filename+' (dynamic)');
                            fs.writeFileSync(outputDir+configName+'/'+filename,mustache.render(template,outer,config.partials),'utf8');
                        }
                    }
                }
    
            });
        });
    });
}

module.exports = {
    main : main
};

