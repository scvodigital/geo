const fs = require('fs');
const path = require('path');
const s = require('string');
const Papa = require('papaparse');
const GT_OSGB = require('./geotools');
const elastic = require('elasticsearch');
const secrets = require('../secrets');
const chunk = require('chunk');

const testLimit = 3;
const timeout = '5m';
const baseDir = path.join(__dirname, '../os-data');
const headerLine = 'id,namesUri,name1,name1Lang,name2,name2Lang,type,localType,geometryX,geometryY,mostDetailViewRes,leastDetailViewRes,mbrXmin,mbrYmin,mbrXmax,mbrYmax,postcodeDistrict,postcodeDistrictUri,populatedPlace,populatedPlaceUri,populatedPlaceType,districtBorough,districtBoroughUri,districtBoroughType,countyUnitary,countyUnitaryUri,countyUnitaryType,region,regionUri,country,countryUri,relatedSpatialObject,sameAsDbpedia,sameAsGeonames';
const acceptedLocalTypes = ['Hamlet', 'Village', 'Island', 'Valley', 'Group Of Islands', 'Suburban Area', 'Town', 'City'];
//const acceptedLocalTypes = ['City'];
const acceptedTypes = ['populatedPlace', 'landform'];

const replacements = {
  place: {
    'Argyll and Bute': 'Argyll & Bute',
    'Dumfries and Galloway': 'Dumfries & Galloway',
    'Perth and Kinross': 'Perth & Kinross',
    'Na h-Eileanan an Iar': 'Na h-Eileanan Siar',
    'Outer Hebrides': 'Na h-Eileanan Siar',
    'Western Isles': 'Na h-Eileanan Siar',
    'Shetland Islands': 'Shetland',
    'Orkney Islands': 'Orkney'
  },
  districtBorough: {
    'Argyll and Bute': 'Argyll & Bute',
    'Dumfries and Galloway': 'Dumfries & Galloway',
    'Perth and Kinross': 'Perth & Kinross',
    'Na h-Eileanan an Iar': 'Na h-Eileanan Siar',
    'Outer Hebrides': 'Na h-Eileanan Siar',
    'Western Isles': 'Na h-Eileanan Siar',
    'Shetland Islands': 'Shetland',
    'Orkney Islands': 'Orkney'
  },
  countyUnitary: {
    'Argyll and Bute': 'Argyll & Bute',
    'Dumfries and Galloway': 'Dumfries & Galloway',
    'Perth and Kinross': 'Perth & Kinross',
    'Na h-Eileanan an Iar': 'Na h-Eileanan Siar',
    'Outer Hebrides': 'Na h-Eileanan Siar',
    'Western Isles': 'Na h-Eileanan Siar',
    'Shetland Islands': 'Shetland',
    'Orkney Islands': 'Orkney'
  }
};

const progress = {
  currentFile: 0,
  totalFiles: 0,
  totalIndexed: 0
};
function getTotalProgress() {
  return '[file: ' + progress.currentFile + '/' + progress.totalFiles +
      ', total: ' + progress.totalIndexed + ']:';
}

(async () => {
  const filenames = fs.readdirSync(baseDir);
  progress.totalFiles = filenames.length;
  for (const filename of filenames) {
    const records = await loadRecords(filename);
    console.log(getTotalProgress(), 'Loaded', records.length, 'from', filename);
    const filtered = records.filter(record => { return filter(record); });
    console.log(getTotalProgress(), filtered.length, 'records left after filtering');
    const places = filtered.map(record => { return getPlace(record); });
    const documents = getDocuments(places);
    if (documents.length > 0) {
      await pageIndex(documents);
    }
    progress.currentFile++;
    progress.totalIndexed += documents.length;
    console.log(getTotalProgress(), 'Finished file');
    //if (progress.currentFile == testLimit) break;
  }
  console.log(getTotalProgress(), 'Done with', allFailed.length, 'total failures');
  fs.writeFileSync(path.join(__dirname, 'failed.json'), JSON.stringify(allFailed, null, 4));
})();

async function pageIndex(documents) {
  const pages = chunk(documents, 100);
  console.log(getTotalProgress(), 'Indexing', documents.length, 'documents in', pages.length, 'pages');
  let count = 0;
  for (const page of pages) {
    let retry = true;
    while(retry) {
      retry = await doIndex(page);
      console.log(getTotalProgress(), 'Indexed page', ++count, 'of', pages.length, 'pages');
    }
  }
}

const client = new elastic.Client({
  host: secrets.eshost,
  version: '5.6'
});
const allFailed = [];
async function doIndex(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return;
  }

  const bulkParams = {
    timeout: timeout,
    body: []
  };

  try {
    for (const document of documents) {
      bulkParams.body.push(document.head);
      bulkParams.body.push(document.body);
    }
  } catch (err) {
    console.error('Problem preparing bulk index body', err);
    return;
  }

  try {
    const indexResponse = await client.bulk(bulkParams);

    if (indexResponse.errors) {
      const failed = [];
      for (const item of indexResponse.items) {
        const error = item.index.error;
        if (error && !error.caused_by.reason.startsWith('illegal lat')) {
          const id = item.index._id;
          for (const document of documents) {
            if (id === document.body.id) {
              document.reason = error;
              failed.push(document);
            }
          }
        }
      }
      if (failed.length > 0) {
        console.error('Failed to index the following', failed);
        allFailed.push(...failed);
      }
    }

    return false;
  } catch(err) {
    console.error('Failed to index page', err);

    const failedDocuments = [];
    for (const document of documents) {
      document.reason = err;
      failedDocuments.push(document);
    }

    allFailed.push(...failedDocuments);

    if (err.message.indexOf('Timeout') > -1) {
      console.log('Waiting for 30 seconds because of the timeout and retrying');
      await delay(30000);
      return true;
    }
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function filter(record) {
  return acceptedLocalTypes.indexOf(record.localType) > -1;
}

function getPlace(record) {
  const coords = getLatLng(record.geometryX, record.geometryY);
  const place = {
    place: placeNameTrimmer(record.name1),
    placeLanguage: record.name1Lang,
    translation: placeNameTrimmer(record.name2),
    translationLanguage: record.name2Lang,
    type: record.type,
    localType: record.localType,
    districtBorough: placeNameTrimmer(duplicateFixer(record.districtBorough)),
    countyUnitary: placeNameTrimmer(duplicateFixer(record.countyUnitary)),
    region: record.region,
    country: record.country,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };

  for (const [field, value] of Object.entries(place)) {
    if (replacements.hasOwnProperty(field)) {
      for (const [before, after] of Object.entries(replacements[field])) {
        if (value === before) {
          place[field] = after;
        }
      }
    }
  }

  return place;
}

function getDocuments(places) {
  const documents = [];
  for (const place of places) {
    let placeNames = [place.place];
    if (place.translation && place.place !== place.translation) {
      placeNames.push(place.translation);
    }

    let suffix;
    if (place.country === 'England') {
      suffix = placeNameTrimmer(place.districtBorough) || place.countyUnitary;
    } else {
      suffix = place.countyUnitary;
    }

    for (const placeName of placeNames) {
      const displayName = (placeName === suffix) ? placeName : placeName + ', ' + suffix;
      const id = s(displayName).slugify().s;
      documents.push({
        head: {
          index: {
            _index: 'geo_lookup',
            _type: 'os_place',
            _id: id
          }
        },
        body: {
          Id: id,
          place: placeName,
          display: displayName,
          autocomplete: displayName,
          textbag: displayName,
          localType: place.localType,
          district: placeNameTrimmer(place.districtBorough),
          county: place.countyUnitary,
          country: place.country,
          point: {
            lat: place.latitude,
            lon: place.longitude
          }
        }
      });
    }
  }
  return documents;
}

function placeNameTrimmer(name) {
  if (!name) return null;
  return name.replace(/(^city\sof\s)|(\scity$)/ig, '');
}

function duplicateFixer(name) {
  if (!name) return null;
  if (name.indexOf(' - ') > -1) {
    const split = name.split(' - ');
    if (split[0] === split[1]) {
      name = split[0];
    }
  }
  return name;
}

const osgb = new GT_OSGB;
function getLatLng(eastings, northings) {
  osgb.setGridCoordinates(eastings, northings);
  const wgs84 = osgb.getWGS84();
  return {
    latitude: wgs84.latitude,
    longitude: wgs84.longitude
  };
}

function loadRecords(filename) {
  return new Promise((resolve, reject) => {
    const csvData = fs.readFileSync(path.join(baseDir, filename)).toString();
    Papa.parse(headerLine + '\r\n' + csvData, {
      newline: '\r\n',
      header: true,
      complete: (results) => {
        const records = results.data;
        resolve(records);
      }
    });
  });
}