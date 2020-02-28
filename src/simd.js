const FS = require('fs');
const Path = require('path');
const PapaParse = require('papaparse');
const Elasticsearch = require('elasticsearch');
const Chunk = require('chunk');

const Client = new Elasticsearch.Client({
  host: require('../secrets.js').eshost,
  apiVersion: '5.6'
});

(async () => {
  const data = await loadData();
  const pages = Chunk(data, 1000);
  console.log(`Processing ${data.length} postcodes in ${pages.length} pages`)
  for (const [index, page] of Object.entries(pages)) {
    console.log(`Current page: ${index} of ${pages.length}`);
    await indexPage(page);
  }
})().then().catch(err => console.error(err));

function loadData() {
  return new Promise((resolve, reject) => {
    const csvPath = Path.join(__dirname, '..', 'data', 'simd.csv');
    const csv = FS.createReadStream(csvPath);

    PapaParse.parse(csv, {
      header: true,
      fastMode: true,
      complete: (results) => resolve(results.data)
    })
  });
}

function indexPage(page) {
  return new Promise((resolve, reject) => {
    const request = { body: [] };

    for (const row of page) {
      const head = {
        update: {
          _id: row.Postcode,
          _type: 'postcode',
          _index: 'geo_lookup'
        }
      };
      const body = {
        doc: {
          dz: row.DZ,
          simd_rank: row.SIMD2020_Rank,
          simd_vigintile: row.SIMD2020_Vigintile,
          simd_decile: row.SIMD2020_Decile,
          simd_quintile: row.SIMD2020_Quintile
        }
      };

      request.body.push(head, body);
    }

    Client.bulk(request, (err, resp) => {
      if (err) {
        console.error('Failed to perform bulk update', err);
        return reject(err);
      }

      resolve(resp);
    })
  });
}