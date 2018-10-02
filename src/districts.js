const { Importer } = require('./importer');
(async function() {
  const importer = new Importer('local-authority-district');
  await importer.setup();

  const districts = require('../data/local-authority-district.json');
  const documents = districts.features.map(feature => {
    const district = feature.properties;
    const geometry = feature.geometry;
    const document = {
      Id: district.lad18cd,
      place: district.lad18nmw ? [district.lad18nm, district.lad18nmw] : district.lad18nm,
      textbag: district.lad18nm + district.lad18nmw,
      point: {
        lat: district.lat,
        lon: district.long
      },
      shape: geometry
    };
    return document; 
  });
  
  importer.push(documents);
})();
