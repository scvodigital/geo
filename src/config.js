module.exports = {
  index: 'geo_data',
  indexPageSize: 10000,
  postcodeBatchSize: 5,
  postcodeProgressChunkSize: 100000,
  postcodeCount: 2616838,
  cooldown: 10000,
  timeout: '5m',
  placesUrl: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/IPN_GB_2016/FeatureServer/0/query?where=1%3D1&outFields=place15cd,place15nm,ctyltnm,lad15cd,lad15nm,pcon15cd,pcon15nm,lat,long&returnDistinctValues=true&outSR=4326&f=json',
  districtsUrl: 'https://opendata.arcgis.com/datasets/593018bf59ab4699b66355bd33cd186d_4.geojson',
  wardsUrl: 'https://opendata.arcgis.com/datasets/07194e4507ae491488471c84b23a90f2_3.geojson',
  nutsLookupUrl: 'https://opendata.arcgis.com/datasets/2a2548641a294734ba4fdb689b12d955_0.geojson',
  nutsUrl: 'https://opendata.arcgis.com/datasets/48b6b85bb7ea43699ee85f4ecd12fd36_3.geojson',
  postcodesUrl: 'https://opendata.arcgis.com/datasets/75edec484c5d49bcadd4893c0ebca0ff_0.csv?session=undefined&outSR=%7B%22wkid%22%3A27700%2C%22latestWkid%22%3A27700%7D',
  jobs: [
    {
      type: 'nhs-scotland',
      dataUrl: 'http://sedsh127.sedsh.gov.uk/Atom_data/ScotGov/ZippedShapefiles/SG_NHS_HealthBoards_2018.zip',
      dataType: 'zipped-shapefile',
      shapeFilename: 'SG_NHS_HealthBoards_2018.shp',
      geoJsonReduce: 20,
      indexTemplate: `{
        "id": {{{stringify feature.properties.HBCode}}},
        "display": {{{stringify feature.properties.HBName}}},
        "place": {{{stringify feature.properties.HBName}}},
        "textbag": {{{stringify feature.properties.HBName}}},
        "autocomplete": {{{stringify feature.properties.HBName}}},
        "shape": {{{stringify feature.geometry}}}
      }`
    },
    {
      type: 'nuts-lookup',
      dataUrl: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD16_LAU118_NUTS318_NUTS218_NUTS118_UK_LUv2/FeatureServer/0/query?where=1%3D1&outFields=LAD16CD,LAD16NM,NUTS318CD,NUTS318NM,NUTS218CD&returnDistinctValues=true&outSR=4326&f=json',
      dataType: 'geojson',
      mapsTemplate: `{
        {{{stringify feature.attributes.LAD16CD}}}: {
          "nuts3Code": {{{stringify feature.attributes.NUTS318CD}}},
          "nuts3Name": {{{stringify feature.attributes.NUTS318NM}}}
        },
        {{{stringify feature.attributes.NUTS318CD}}}: {
          "districtCode": {{{stringify feature.attributes.LAD16CD}}},
          "districtName": {{{stringify feature.attributes.LAD16NM}}}
        },
        {{{stringify feature.attributes.NUTS318NM}}}: {
          "districtCode": {{{stringify feature.attributes.LAD16CD}}},
          "districtName": {{{stringify feature.attributes.LAD16NM}}}
        }
      }`
    },
    {
      type: 'district',
      dataUrl: 'https://opendata.arcgis.com/datasets/593018bf59ab4699b66355bd33cd186d_4.geojson',
      dataType: 'geojson',
      indexTemplate: `{
        "id": {{{stringify feature.properties.lad18cd}}},
        "display": {{{stringify feature.properties.lad18nm}}},
        "place": {{{stringify feature.properties.lad18nm}}},
        "textbag": {{{stringify feature.properties.lad18nm}}},
        "autocomplete": {{{stringify feature.properties.lad18nm}}},
        "lat": {{{stringify feature.properties.lat}}},
        "lon": {{{stringify feature.properties.long}}},
        "shape": {{{stringify feature.geometry}}},
      }`,
      mapsTemplate: `{
        {{{stringify feature.properties.lad18cd}}}: {
          "place": {{{stringify feature.properties.lad18nm}}}
        },
        {{{stringify feature.properties.lad18nm}}}: {
          "id": {{{stringify feature.properties.lad18cd}}}
        }
      }`
    },
    {
      type: 'nhs-england',
      dataUrl: 'https://opendata.arcgis.com/datasets/b9d40a5fcdc74124b2244d05705ae492_4.geojson',
      dataType: 'geojson',
      indexTemplate: `{
        "id": {{{stringify feature.properties.nhser18cd}}},
        "display": {{{stringify feature.properties.nhser18nm}}},
        "place": {{{stringify feature.properties.nhser18nm}}},
        "textbag": {{{stringify feature.properties.nhser18nm}}},
        "autocomplete": {{{stringify feature.properties.nhser18nm}}},
        "lat": {{{stringify feature.properties.lat}}},
        "lon": {{{stringify feature.properties.long}}},
        "shape": {{{stringify feature.geometry}}},
      }`
    },
    {
      type: 'nhs-wales',
      dataUrl: 'https://opendata.arcgis.com/datasets/87e71b2c79fc4ac894eeb79359cda131_4.geojson',
      dataType: 'geojson',
      indexTemplate: `{
        "id": {{{stringify feature.properties.lhb16cd}}},
        "display": {{{stringify feature.properties.lhb16nm}}},
        "place": {{{stringify feature.properties.lhb16nm}}},
        "textbag": {{{stringify feature.properties.lhb16nm}}},
        "autocomplete": {{{stringify feature.properties.lhb16nm}}},
        "lat": {{{stringify feature.properties.lat}}},
        "lon": {{{stringify feature.properties.long}}},
        "shape": {{{stringify feature.geometry}}},
      }`
    },
    {
      type: 'ward',
      dataUrl: 'https://opendata.arcgis.com/datasets/07194e4507ae491488471c84b23a90f2_3.geojson',
      dataType: 'geojson',
      indexTemplate: `{
        "id": {{{stringify feature.properties.wd17cd}}},
        "display": {{{stringify feature.properties.wd17nm}}},
        "place": {{{stringify feature.properties.wd17nm}}},
        "textbag": {{{stringify feature.properties.wd17nm}}},
        "autocomplete": {{{stringify feature.properties.wd17nm}}},
        "lat": {{{stringify feature.properties.lat}}},
        "lon": {{{stringify feature.properties.long}}},
        "shape": {{{stringify feature.geometry}}}
      }`,
      mapsTemplate: `{
        {{{stringify feature.properties.wd17cd}}}: {
          "place": {{{stringify feature.properties.wd17nm}}}
        },
        {{{stringify feature.properties.wd17nm}}}: {
          "id": {{{stringify feature.properties.wd17cd}}}
        }
      }`
    },
    {
      type: 'nuts-3',
      dataUrl: 'https://opendata.arcgis.com/datasets/473aefdcee19418da7e5dbfdeacf7b90_4.geojson',
      dataType: 'geojson',
      indexTemplate: `{
        "id": {{{stringify feature.properties.nuts318cd}}},
        "display": {{{stringify feature.properties.nuts318nm}}},
        "place": {{{stringify feature.properties.nuts318nm}}},
        "textbag": {{{stringify feature.properties.nuts318nm}}},
        "autocomplete": {{{stringify feature.properties.nuts318nm}}},
        "lat": {{{stringify feature.properties.lat}}},
        "lon": {{{stringify feature.properties.long}}},
        "shape": {{{stringify feature.geometry}}}
      }`,
      mapsTemplate: `{
        {{{stringify feature.properties.nuts318cd}}}: {
          "place": {{{stringify feature.properties.nuts318nm}}}
        },
        {{{stringify feature.properties.nuts318nm}}}: {
          "id": {{{stringify feature.properties.nuts318cd}}}
        }
      }`
    }
  ]
}
