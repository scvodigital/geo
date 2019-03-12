const fs = require('fs');
const path = require('path');
const s = require('string');
const elastic = require('elasticsearch');
const secrets = require('../secrets');
const chunk = require('chunk');
const Papa = require('papaparse');

const testLimit = 3;
const timeout = '5m';

const client = new elastic.Client({
  host: secrets.eshost,
  version: '5.6'
});
const allFailed = [];

const progress = {
  totalPages: 0,
  totalPlaces: 0,
  currentPage: 0,
  totalIndexed: 0
};
function getTotalProgress() {
  return '[page: ' + progress.currentPage + '/' + progress.totalPages +
      ', total: ' + progress.totalIndexed + ']:';
}

(async () => {
  const data = await getData();

  progress.totalPlaces = data.length;
  console.log('Processing features...');

  let documents = data.map((place) => {
    const postcodesActive = Number(place['Active postcodes']);

    if (!place.Latitude || postcodesActive === 0) return null;

    const district = placeNameTrimmer(place.Region);
    const outcode = place.Postcode;
    const name = outcode + ', ' + district;

    return {
      head: {
        index: {
          _index: 'geo_lookup',
          _type: 'outcode',
          _id: outcode
        }
      },
      body: {
        Id: outcode,
        place: outcode,
        display: name,
        autocomplete: outcode,
        textbag: outcode,
        localType: "Outcode",
        district: district,
        postcodesActive: postcodesActive,
        point: {
          lat: place.Latitude,
          lon: place.Longitude
        }
      }
    };
  });

  documents = documents.filter(document => { return Boolean(document); });

  //console.log(JSON.stringify(documents, null, 4));
  //process.exit();

  const pages = chunk(documents, 100);
  progress.totalPages = pages.length;
  let count = 0;
  for (const page of pages) {
    let retry = true;
    while(retry) {
      retry = await doIndex(page);
      if (retry) {
        console.log(getTotalProgress(), 'Failed, retrying');
      }
    }
    progress.currentPage++;
    progress.totalIndexed += page.length;
    console.log(getTotalProgress(), 'Indexed');
  }

  console.log('Finished indexing');
})();

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

function placeNameTrimmer(name) {
  if (!name) return null;
  return name.replace(/(^city\sof\s)|(\scity$)/ig, '');
}

function getData() {
  return new Promise((resolve, reject) => {
    const csv = fs.readFileSync(path.join(__dirname, '../data/postcode-districts.csv')).toString();
    Papa.parse(csv, {
      header: true,
      complete: (results) => {
        const records = results.data;
        resolve(records);
      }
    });
  });
}