const { Readable }  = require('stream');
const { StringStream } = require('scramjet');
const r = require('request');
const rp = require('request-promise-native');

const MultiProgress = require('multi-progress');
const multi = new MultiProgress(process.stderr);

const CONFIG = require('./config');
const SECRETS = require('../secrets');
const { Indexer } = require('./indexer');

const fresh = process.argv.length >= 3 && process.argv[2] === 'fresh';

const masterProgressBar = multi.newBar('    Pre-postcode: [:bar] :percent | :current/:total', {
  complete: '=',
  incomplete: ' ',
  width: 50,
  total: 8
});
function incrementMasterProgress(nextTask) {
  masterProgressBar.tick();
}

const indexer = new Indexer({
  host: SECRETS.eshost,
  index: CONFIG.index,
  pageSize: CONFIG.indexPageSize,
  cooldown: CONFIG.cooldown,
  fresh: fresh
}, multi);

const maps = {
  districts: {},
  wards: {},
  nuts: {}
};

async function processDistricts() {
  //console.log('Downloading Districts data from', CONFIG.districtsUrl);
  let districts;
  try {
    districts = await rp({
      uri: CONFIG.districtsUrl,
      json: true,
      timeout: 1000 * 60 * 10
    });
  } catch(err) {
    console.error('Failed to download Districts data', err);
    process.exit();
  }
  incrementMasterProgress('Districts data downloaded. Processing...');
  const documents = districts.features.map(feature => {
    try {
      const district = feature.properties;
      const geometry = feature.geometry;
      const document = indexer.createDocument('local-authority-district', district.lad18cd, [district.lad18nm, district.lad18nmw], district.lat, district.long, geometry);
      maps.districts[document.body.Id] = document.body.place;
      return document; 
    } catch(err) {
      console.error('Failed to process district', JSON.stringify(feature, null, 4), err);
      process.exit();
    }
  });
  indexer.push(documents);
  incrementMasterProgress('Districts processed');
}

async function processWards() {
  //console.log('Downloading Wards data from', CONFIG.wardsUrl);
  let wards;
  try {
    wards = await rp({
      uri: CONFIG.wardsUrl,
      json: true,
      timeout: 1000 * 60 * 10
    });
  } catch(err) {
    console.error('Failed to download Wards data', err);
    process.exit();
  }
  incrementMasterProgress('Wards data downloaded. Processing...');
  const documents = wards.features.map(feature => {
    try {
      const ward = feature.properties;
      const geometry = feature.geometry;
      const document = indexer.createDocument('electoral-ward', ward.wd17cd, [ward.wd17nm, ward.wd17nmw], ward.lat, ward.long, geometry);
      maps.wards[document.body.Id] = document.body.place;
      return document; 
    } catch(err) {
      console.error('Failed to process Ward', JSON.stringify(feature, null, 4), err);
      process.exit();
    }
  });
  indexer.push(documents);
  incrementMasterProgress('Wards processed');
}

async function processNutsLookup() {
  //console.log('Downloading NUTS Lookup data from', CONFIG.nutsLookupUrl);
  let nutsLookup;
  try {
    nutsLookup = await rp({
      uri: CONFIG.nutsLookupUrl,
      json: true,
      timeout: 1000 * 60 * 10
    });
  } catch(err) {
    console.error('Failed to download NUTS Lookup data', err);
    process.exit();
  }
  incrementMasterProgress('NUTS Lookup data downloaded. Processing...');
  for (const feature of nutsLookup.features) {
    try {
      maps.nuts[feature.properties.LAD16CD] = feature.properties.NUTS218NM;
    } catch(err) {
      console.error('Failed to process NUTS Lookup', JSON.stringify(feature, null, 4), err);
      process.exit();
    }
  } 
  incrementMasterProgress('NUTS Lookup processed');
}

async function processNuts() {
  //console.log('Downloading NUTS Level 2 data from', CONFIG.nutsUrl);
  let nuts;
  try {
    nuts = await rp({
      uri: CONFIG.nutsUrl,
      json: true,
      timeout: 1000 * 60 * 10
    });
  } catch(err) {
    console.error('Failed to download NUTS Level 2 data', err);
    process.exit();
  }
  incrementMasterProgress('NUTS level 2 data downloaded. Processing...');
  const documents = nuts.features.map(feature => {
    try {
      const nuts = feature.properties;
      const geometry = feature.geometry;
      const document = indexer.createDocument('nuts-level-2', nuts.nuts218cd, nuts.nuts218nm, nuts.lat, nuts.long, geometry);
      return document;
    } catch(err) {
      console.error('Failed to process NUTS', JSON.stringify(feature, null, 4), err);
      process.exit();
    }
  });
  indexer.push(documents);
  incrementMasterProgress('NUTS Level 2 data processed');
}

function processPostcodes() {
  return new Promise(async function(resolve, reject) {
    const postcodeProgressBar = multi.newBar('    Postcodes processed: [:bar] :percent | :current/:total', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: CONFIG.postcodeCount
    });

    const request = r(CONFIG.postcodesUrl)
      .pipe(new StringStream())
      .CSVParse({
        delimeter: ',',
        header: true
      })
      .batch(CONFIG.postcodeBatchSize)
      .map(postcodes => {
        const documents = postcodes.map(postcode => {
          try {
            const document = indexer.createDocument('postcode', postcode.pcd, postcode.pcd, postcode.lat, postcode.long, null);
            if (maps.districts.hasOwnProperty(postcode.oslaua)) {
              document.body.district = maps.districts[postcode.oslaua];
            }
            if (maps.wards.hasOwnProperty(postcode.osward)) {
              document.body.ward = maps.wards[postcode.osward];
            }
            if (maps.nuts.hasOwnProperty(postcode.oslaua)) {
              document.body.nuts = maps.nuts[postcode.oslaua];
            }
            return document;
          } catch(err) {
            console.error('Failed to process Postcode', JSON.stringify(postcode, null, 4), err);
            process.exit();
          }
        });
        indexer.push(documents);
        postcodeProgressBar.tick(documents.length);
      });
  });
}

(async function() {
  try {
    await indexer.setup();
    indexer.startIndexer();
    await processDistricts();
    await processWards();
    await processNutsLookup();
    await processNuts();
    await processPostcodes();  

    console.log('Finished all processing tasks, wait for the indexer queue to be empty for a bit');
  } catch(err) {
    console.error('Something went wrong', err);
  }
})();

