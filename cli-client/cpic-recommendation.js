#!/usr/bin/env node
const program = require('commander');
const axios = require('axios');
const csvtojson = require('csvtojson');
const readStdIn = require('./read-std-in');

const genophenokolistPath = '/99999/fk4qj7sz2t/genophenokolist';
const druglistPath = '/99999/fk4qj7sz2s/druglist';
const batchSize = 50;
const batchTiming = 500;
var host;
var filename;
var results = [];

program
  .version('0.1.0')
  .description('Use the CPIC toolkit to process panels of patient data')
  .arguments('[host]').action((hostArg) => {
    host = hostArg || 'http://localhost:8080';
  }).on('--help', function() {
    console.log('');
    console.log('Examples:');
    console.log('');
    console.log('  $ cat panel.json | cpic http://localhost:8081 > results.json');
    console.log('  $ cat panel.json | cpic https://kgrid-activator.herokuapp.com');
  }).parse(process.argv);

// Read from standard in in batches
readStdIn().then(async (input) => {
  var data = JSON.parse(input);
  var batches = Math.ceil(data.length / batchSize);
  for (var currentBatch = 0; currentBatch < batches; currentBatch++) {
    var batch = data.slice(batchSize * currentBatch, batchSize * (currentBatch + 1));
    // Throttling with setTimeout
    await new Promise(resolve => {
      setTimeout(() => resolve(processPatientData(batch)), batchTiming)
    });
  }
  console.log(JSON.stringify(results, null, 4));
});

async function processPatientData (dataBatch) {

  var count=dataBatch.length
  for(var i=0; i<count;i++){
    // dataBatch.forEach(async function (patientData) {
    var patientData = dataBatch[i]

    var patientRecommendations = [];

    // Convert the string list of prescriptions separated by spaces into an
    // object with a key for each prescription, this needs to be done
    // because the current JS adapter cannot read in arrays :(
    var drugObj = {};

    if (patientData.prescriptions)
      patientData.prescriptions.split(' ').forEach(rx => {drugObj[rx] = true});

    try {
      // Get genotype to phenotype ko addresses, then generate phenotype panel for patient
      // then generate drug recommendations, then aggregate the results in an object
      var response = await postJsonRequest(genophenokolistPath, patientData.diplotype);
      var phenotypePanel = await generatePhentotypes(response.data.result, patientData.diplotype);
      await generateDrugRecs(drugObj, phenotypePanel, patientRecommendations);
      await aggregateResults(patientData.patient, patientRecommendations);
    } catch(error) {
      if (error.response) {
        console.error(error.response.data);
      } else if (error.request) {
        console.error('Cannot connect to', error.request._currentUrl,
            'check the host name or specify a host with $ cpic [host]');
        process.exit(1);
      } else {
        console.error(error.message);
      }
    }
  };
}

function postJsonRequest(path, data) {
  return axios({
    method: 'post',
    url: host + path,
    headers: {'Content-Type': 'application/json'},
    data: data
  });
}

function aggregateResults(patient, patientRecommendations) {
  var currentTime = new Date().toLocaleString('en-US');
  patientResult = {
    "patient": patient,
    "time": currentTime,
    "recommendations": patientRecommendations
  };
  return new Promise(resolve => {resolve(results.push(patientResult));});
}

function generatePhentotypes(diplotypeObjectMap, diplotypePanel) {
  var gToPMap = diplotypeObjectMap;

  // Create an array of genotype to phenotype request promises
  var gToPPromises = Object.keys(gToPMap).map(function (key) {
    if (gToPMap[key] != '' && gToPMap[key] != null) {
      return postJsonRequest(gToPMap[key] + '/phenotype', diplotypePanel);
    }
  }).filter(element => {return element}); // gets rid of null or undefined elements

  // Use each genotype to phenotype object to get the phenotype panel
  return axios.all(gToPPromises).then((results) => {
    var phenotypePanel = {};
    var ret = results.forEach(response => {
      var phenotype = response.data.result;
      Object.keys(phenotype).map(key => {
        phenotypePanel[key] = phenotype[key];
      });
    });
    // Add in diplotypes that weren't processed in the first stage
    Object.keys(diplotypePanel).forEach(gene => {
      if(!phenotypePanel[gene] && diplotypePanel[gene]){
        phenotypePanel[gene] = {};
        phenotypePanel[gene].diplotype = diplotypePanel[gene];
        phenotypePanel[gene].phenotype = '';
      }
    });
    return phenotypePanel;
  })
  .catch(error => {
    console.error(error);
  })
}

function generateDrugRecs(rxObj, phenotypePanel, patientRecommendations) {
  // Get the list of drug recommendation objects
  return postJsonRequest(druglistPath, rxObj)
  .then(response => {
    var drugMap = response.data.result;
    var drugRecPromises = [];
    // Create an array of drug recommendation request promises
    Object.keys(drugMap).forEach(drugKey => {
      if (drugMap[drugKey] != '')
        drugRecPromises.push(
            postJsonRequest(drugMap[drugKey] + '/dosingrecommendation',
                phenotypePanel));
    });
    // Use each drug recommendation object to get a recommendation
    return axios.all(drugRecPromises).then(results => {
      results.forEach(response => {
        var result = response.data.result;
        patientRecommendations.push(result);
      });
      return phenotypePanel;
    })
  }).catch(error => {
    console.error(error);
  });
}
