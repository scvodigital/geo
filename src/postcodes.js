const { Importer } = require('./importer');
const fs = require('fs');
const Papa = require('papaparse');

(async function() {
  const importer = new Importer('postcode', 'local-authority-district');
  await importer.setup();

  const postcodes = fs.createReadStream('./data/postcode.csv');
  const totalSize = fs.statSync('./data/postcode.csv').size;
  const head = { index: 'geo', type: 'postcode' };
  let lastPercent = 0;
  Papa.LocalChunkSize = 2;

  Papa.parse(postcodes, {
    delimiter: ',',
    header: true,
    chunk: (results, parser) => {
      const documents = results.data.map(postcode => {
        const document = {
          Id: postcode.pcd,
          place: postcode.pcd,
          textbag: postcode.pcd,
          point: {
            lat: postcode.lat,
            lon: postcode.long
          },
          parent: postcode.oslaua,
          ward: postcode.osward
        };
        return document;
      });
      importer.push(documents);
      const percent = Math.floor((results.meta.cursor / totalSize) * 100);
      if (percent > lastPercent) {
        lastPercent = percent;
        console.log('Documents processed:', documents.length, '| Parsed', percent + '%');
      }
    },
    error: (err) => {
      console.error('Parser error:', err);
    },
    complete: (results, file) => {
      console.log('COMPLETED:', documents.length);
      const transformed = JSON.stringify(documents, null, 2);
      fs.writeFileSync('./data/postcode-transformed.json', transformed);
      console.log('Written file');
    }
  });
})();
