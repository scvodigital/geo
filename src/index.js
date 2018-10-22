const { Readable }  = require('stream');
const fs = require('fs');
const { Duplex } = require('stream');
const path = require('path');
const { StringStream } = require('scramjet');
const r = require('request');
const rp = require('request-promise-native');
const dateFns = require('date-fns');
const globby = require('globby');
const shp2json = require('shp2json');
const turf = require('@turf/turf');
const geojsonReducer = require('geojson-reducer');
const MultiProgress = require('multi-progress');
const hbs = require('clayhandlebars')();

const multi = new MultiProgress(process.stderr);

const CONFIG = require('./config');
const SECRETS = require('../secrets');
const { Indexer } = require('./indexer');

const args = process.argv.splice(2);
const fresh = args.indexOf('fresh') > -1;

const onlyFlag = args.indexOf('only');
const onlyIndex = onlyFlag > -1 ? args.slice(onlyFlag + 1) : CONFIG.jobs.map(job => job.type);

const startIndex = Number(args.filter(arg => Number(arg))[0]) || 0;

const masterProgressBar = multi.newBar('Processing jobs: [:bar] :percent | :current/:total', {
  complete: '=',
  incomplete: ' ',
  width: 50,
  total: 10
});

const indexer = new Indexer({
  host: SECRETS.eshost,
  index: CONFIG.index,
  pageSize: CONFIG.indexPageSize || 10000,
  cooldown: CONFIG.cooldown,
  fresh: fresh,
  startIndex: startIndex,
  timeout: CONFIG.timeout || '5m'
}, multi);

const maps = {};

async function processJobs() {
  let totalTasks = 0;
  for (const job of CONFIG.jobs) {
    maps[job.type] = {};
    totalTasks++;
    if (job.dataType !== 'csv' && job.dataType !== 'recovery') {
      totalTasks++;
      totalTasks += job.reduceGeoJson || 0;
    }
  }
  masterProgressBar.total = totalTasks;

  for (const job of CONFIG.jobs) {
    switch (job.dataType) {
      case ('geojson'): 
        await processGeoJsonJob(job);
        break;
      case ('csv'):
        await processCsvJob(job);
        break;
      case ('zipped-shapefile'):
        await processZippedShapefileJob(job);
        break;
      case ('recovery'):
        await processRecoveryJob(job);
        break;
    }
  }
}

async function processRecoveryJob(job) {
  const oldIndexPageSize = indexer.pageSize;
  const recoveryJson = fs.readFileSync(job.path).toString();
  const recoveryDocuments = JSON.parse(recoveryJson);

  indexer.push(documents); 

  masterProgressBar.tick();
}

async function processGeoJsonJob(job) {
  const indexTemplate = job.indexTemplate ? hbs.compile(job.indexTemplate) : null;
  const mapsTemplate = job.mapsTemplate ? hbs.compile(job.mapsTemplate) : null;
  
  let geoJson = await rp({
    uri: job.dataUrl,
    json: true,
    timeout: 1000 * 60 * 10
  });
  
  masterProgressBar.tick();

  if (job.geoJsonReduce) {
    geoJson = reduce(geoJson, job);
  }

  if (job.unkinkPolygon) {
    geoJson = unkinkPolygon(geoJson, job);
  }
  
  const documents = [];
  for (const feature of geoJson.features) {
    if (indexTemplate && onlyIndex.indexOf(job.type) > -1) {
      const document = getDocument(indexTemplate, feature, job);
      documents.push(document);
    }
    if (mapsTemplate) {
      updateMaps(mapsTemplate, feature, job);
    }
  }

  if (documents.length > 0) {
    indexer.push(documents);
  }

  masterProgressBar.tick();
}

function processCsvJob(job) {
  return new Promise((resolve, reject) => {
    const indexTemplate = job.indexTemplate ? hbs.compile(job.indexTemplate) : null;
    const mapsTemplate = job.mapsTemplate ? hbs.compile(job.mapsTemplate) : null;
  
    const request = r(job.dataUrl)
      .pipe(new StringStream())
      .CSVParse({
        delimeter: ',',
        header: true
      })
      .batch(job.batchSize)
      .map(features => {
        const documents = [];
        for (const feature of features) {
          if (indexTemplate && onlyIndex.indexOf(job.type) > -1) {
            const document = getDocument(indexTemplate, feature, job);
            documents.push(document);
          }
          if (mapsTemplate) {
            updateMaps(mapsTemplate, feature, job);
          }
        }
        if (documents.length > 0) {
          indexer.push(documents);
        }
      })
      .whenEnd(() => {
        masterProgressBar.tick();
        resolve();
      })
      .whenError((err) => {
        masterProgressBar.tick();
        reject(err);
      });
  });
}

function processZippedShapefileJob(job) {
  return new Promise(async (resolve, reject) => {
    const indexTemplate = job.indexTemplate ? hbs.compile(job.indexTemplate) : null;
    const mapsTemplate = job.mapsTemplate ? hbs.compile(job.mapsTemplate) : null;

    const res = await rp({
      url: job.dataUrl,
      encoding: null
    });
    const buff = Buffer.from(res, 'utf8');
    
    masterProgressBar.tick();

    const stream = new Duplex();
    stream.push(buff);
    stream.push(null);
    const outStream = shp2json(stream);

    let jsonChunks = [];
    let readCount = 0;
    outStream.on('data', function(data) {
      data = data.toString();
      jsonChunks.push(data);
    });

    outStream.on('end', async function() {
      const json = jsonChunks.join('');
      let geoJson;

      if (job.geoJsonReduce) {
        const before = json.length;
        geoJson = reduce(json, job);
        const after = JSON.stringify(geoJson).length;
      } else {
        geoJson = JSON.parse(json);
      }
      const documents = [];

      if (job.unkinkPolygon) {
        geoJson = unkinkPolygon(geoJson, job);
      }
      
      for (const feature of geoJson.features) {
        if (indexTemplate && onlyIndex.indexOf(job.type) > -1) {
          const document = getDocument(indexTemplate, feature, job);
          documents.push(document);
        }
        if (mapsTemplate) {
          updateMaps(mapsTemplate, feature, job);
        }
      }

      if (documents.length > 0) {
        indexer.push(documents);
      }

      masterProgressBar.tick();
      resolve()
    });
  });
}

function getDocument(indexTemplate, feature, job) {
  const bodyJson = indexTemplate({ maps: maps, feature: feature, job: job });
  try {
    const body = JSON.parse(bodyJson);
    const head = {
      index: {
        _index: CONFIG.index,
        _type: job.type,
        _id: body.id
      }
    };
    return { head: head, body: body };
  } catch(err) {
    console.error('Failed to make document', bodyJson, err);
    process.exit();
    return null;
  }
}

function updateMaps(mapsTemplate, feature, job) {
  const mapsJson = mapsTemplate({ maps: maps, feature: feature, job: job });
  try {
    const mapsObject = JSON.parse(mapsJson);
    for (const [key, value] of Object.entries(mapsObject)) {
      maps[job.type][key] = value;
    }
  } catch(err) {
    console.error('Failed to make maps stuff', mapsJson, err);
    process.exit();
  }
}

function unkinkPolygon(featureCollection, job) {
  try {
    featureCollection = turf.unkinkPolygon(featureCollection);
    
    const featuresMap = {};
    for (const feature of featureCollection.features) {
      const id = feature.properties[job.idProperty];
      if (!featuresMap.hasOwnProperty(id)) {
        featuresMap[id] = turf.multiPolygon([feature.geometry.coordinates], feature.properties);
      } else {
        featuresMap[id].geometry.coordinates.push(feature.geometry.coordinates);
      }
    }

    const features = turf.featureCollection(Object.values(featuresMap));
    return features;
  } catch (err) {
    console.error('Failed to ukink polygons', err, job);
    return featureCollection;
  }
}

function reduce(geoJson, job) {
  try {
    for (let t = 0; t < job.geoJsonReduce; t++) {
      if (typeof geoJson !== 'string') {
        geoJson = JSON.stringify(geoJson);
      }
      console.log('Reduction:', t, '| Before:', geoJson.length);
      geoJson = geojsonReducer.reduceGeoJson(geoJson);
      geoJson = fixPolygons(geoJson, job);
      console.log('Reduction:', t, '| After:', JSON.stringify(geoJson).length);
      masterProgressBar.tick();
    }
    return geoJson;
  } catch (err) {
    console.error('Failed to reduce polygons', err, job);
    process.exit();
  }
}

function fixPolygons(geoJson, job) {
  try {
    for (const feature of geoJson.features) {
      if (feature.geometry.type == 'MultiPolygon' || feature.geometry.type == 'Polygon') {
        feature.coordinates = fixCoordArray(feature.geometry.coordinates, job);
      } 
    }
  } catch (err) {
    console.error('Failed to fix polygons', err, job);
  }
  return geoJson;
}

function fixCoordArray(array) {
  try {
  if (isCoordsArray(array)) {
    const seen = {};
    array = array.filter(coord => {
      const key = coord.join();
      return seen.hasOwnProperty(key) ? false : (seen[key] = true);
    });

    if (array.length < 8) {
      for (let c = 0; c < array.length - 1; c++) {
        const midLat = (array[c][0] + array[c + 1][0]) / 2;
        const midLng = (array[c][1] + array[c + 1][1]) / 2;
        array.splice(++c, 0, [midLat, midLng]);
      }
    }

    array.push(array[0]);
  } else { 
    if (Array.isArray(array)) {
      for (let i = 0; i < array.length; i++) {
        array[i] = fixCoordArray(array[i]);
      }
    } else {
    }
  }
  return array;
  } catch (err) {
    console.error('Failed to fix coord array', err, job);
    process.exit();
  }
}

function isCoordsArray(array) {
  return Array.isArray(array) && 
    array.length > 0 &&
    Array.isArray(array[0]) &&
    array[0].length === 2 &&
    typeof array[0][0] === 'number' &&
    typeof array[0][1] === 'number' ;
}

async function main() {
  try {
    console.log('Job started at:', dateFns.format('YYYY-MM-DD HH:mm:ss')); 

    await indexer.setup();
    indexer.startIndexer();

    await processJobs();
  } catch(err) {
    console.error('Something went wrong', err);
  }
};

function sleep(ms, debug = false) {
  return new Promise((resolve, reject) => {
    if (debug) {
      console.log('Sleeping for', ms + 'ms');
    }
    setTimeout(() => {
      console.log('Finished sleeping');
      resolve();
    }, ms);
  });
}

if (process.debugPort) {
  console.log('Debug mode on. Connect your inspector and press any key to continue.');
  process.stdin.once('data', async function () {
    await main();
  });
} else {
  (async function() {
    await main();
  })();
}

/*
 Reference for currently un configured types
async function processNutsLookup() {
  for (const feature of nutsLookup.features) {
      maps.nuts[feature.properties.LAD16CD] = feature.properties.NUTS218NM;

function processPostcodes() {
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
*/
