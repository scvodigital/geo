const { Importer } = require('./importer');
(async function() {
  const importer = new Importer('electoral-ward');
  await importer.setup();

  const wards = require('../data/electoral-ward.json');
  const documents = wards.features.map(feature => {
    const ward = feature.properties;
    const document = {
      Id: ward.wd17cd,
      place: ward.wd17nmw && ward.wd17nmw !== ' ' ? [ward.wd17nm, ward.wd17nmw] : ward.wd17nm,
      textbag: ward.wd17nm + ward.wd17nmw,
      point: {
        lat: ward.lat,
        lon: ward.long
      },
      shape: ward.geometry
    };
    return document; 
  });

  importer.push(documents);
})();
