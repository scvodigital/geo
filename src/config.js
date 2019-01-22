//TODO: Test county-lookup and the new lookups added to wards and districts
//TODO: Also add Westminster Parliamentary Constituancy as a type and get wards and districts to look their PCON up in that too
//TODO: Update postcodes to get their PCON from new PCON map instead of the Places map which may no longer be accurate
//TODO: Index!

module.exports = {
  index: 'geo_lookup',
  indexPageSize: 100000,
  postcodeBatchSize: 5,
  postcodeProgressChunkSize: 100000,
  postcodeCount: 2616838,
  cooldown: 10000,
  timeout: '5m',
  jobs: [
/*    {
      type: 'recovery',
      dataType: 'recovery',
      path: './data/failed/recovery-2018-11-04-21-04-51.json'
    },*/
    {
      type: 'county-lookup',
      dataUrl: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/WD16_LAD16_CTY16_OTH_UK_LU/FeatureServer/0/query?where=1%3D1&outFields=WD16CD,WD16NM,LAD16CD,LAD16NM,CTY16CD,CTY16NM&returnGeometry=false&outSR=4326&f=json',
      dataType: 'geojson',
      paging: true,
      mapsTemplate: `{
        "district": {
          {{{stringify feature.attributes.LAD16CD}}}: {
            "countyCode": {{{stringify feature.attributes.CTY16CD}}},
            "countyName": {{{stringify feature.attributes.CTY16NM}}},
            "districtName": {{{stringify feature.attributes.LAD16NM}}}
          }
        },
        "ward": {
          {{{stringify feature.attributes.WD16CD}}}: {
            "districtCode": {{{stringify feature.attributes.LAD16CD}}},
            "districtName": {{{stringify feature.attributes.LAD16NM}}},
            "countyCode": {{{stringify feature.attributes.CTY16CD}}},
            "countyName": {{{stringify feature.attributes.CTY16NM}}}
          }
        }
      }`
    },
    {
      type: 'nuts-lookup',
      dataUrl: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD16_LAU118_NUTS318_NUTS218_NUTS118_UK_LUv2/FeatureServer/0/query?where=1%3D1&outFields=LAD16CD,LAD16NM,NUTS318CD,NUTS318NM&outSR=4326&f=json',
      dataType: 'geojson',
      paging: true,
      mapsTemplate: `{
        "district": {
          {{{stringify feature.attributes.LAD16CD}}}: {
            "nuts3Code": {{{stringify feature.attributes.NUTS318CD}}},
            "nuts3Name": {{{stringify feature.attributes.NUTS318NM}}},
            "districtName": {{{stringify feature.attributes.LAD16NM}}}
          }
        }
      }`
    },
    {
      type: 'district',
      dataUrl: 'https://ons-inspire.esriuk.com/arcgis/rest/services/Administrative_Boundaries/Local_Authority_Districts_May_2018_Boundaries/MapServer/4/query?where=1%3D1&outFields=lad18cd,lad18nm,lat,long&returnGeometry=false&outSR=4326&f=json',
      dataType: 'geojson',
      paging: true,
      mapsTemplate: `{
        {{{stringify feature.attributes.lad18cd}}}: {{{stringify feature.attributes.lad18nm}}},
        {{{stringify feature.attributes.lad18nm}}}: {{{stringify feature.attributes.lad18cd}}}
      }`,
      /*indexTemplate: `{
        "id": {{{stringify feature.attributes.lad18cd}}},
        "display": {{{stringify feature.attributes.lad18nm}}},
        "place": {{{stringify feature.attributes.lad18nm}}},
        "textbag": {{{stringify feature.attributes.lad18nm}}},
        "autocomplete": {{{stringify feature.attributes.lad18nm}}},
        "nuts_3": {{{stringify (dot (concat feature.attributes.lad18cd '.nuts3Name') maps.nuts-lookup.district)}}},
        "county": {{{stringify (dot (concat feature.attributes.lad18cd '.countyName') maps.county-lookup.district)}}},
        "region_codes": {
          "nuts_3": {{{stringify (dot (concat feature.attributes.lad18cd '.nuts3Code') maps.nuts-lookup.district)}}},
          "county": {{{stringify (dot (concat feature.attributes.lad18cd '.countyCode') maps.county-lookup.district)}}}
        },
        "point": {
          "lat": {{{stringify feature.attributes.lat}}},
          "lon": {{{stringify feature.attributes.long}}}
        },
      }`*/
    },
    {
      type: 'ward',
      dataUrl: 'https://ons-inspire.esriuk.com/arcgis/rest/services/Administrative_Boundaries/Wards_December_2017_Boundaries/MapServer/3/query?where=1%3D1&outFields=wd17nm,long,lat,wd17cd&returnGeometry=false&outSR=4326&f=json',
      dataType: 'geojson',
      paging: true,
      mapsTemplate: `{
        {{{stringify feature.attributes.wd17cd}}}: {{{stringify feature.attributes.wd17nm}}},
        {{{stringify feature.attributes.wd17nm}}}: {{{stringify feature.attributes.wd17cd}}}
      }`,
      /*indexTemplate: `{
        "id": {{{stringify feature.attributes.wd17cd}}},
        "display": {{{stringify feature.attributes.wd17nm}}},
        "place": {{{stringify feature.attributes.wd17nm}}},
        "textbag": {{{stringify feature.attributes.wd17nm}}},
        "autocomplete": {{{stringify feature.attributes.wd17nm}}},
        "district": {{{stringify (dot (concat feature.attributes.wd17cd '.districtName') maps.county-lookup.district)}}},
        "county": {{{stringify (dot (concat feature.attributes.wd17cd '.countyName') maps.county-lookup.district)}}},
        "nuts_3": {{{stringify (dot (concat (dot (concat feature.attributes.wd17cd '.districtCode') maps.county-lookup.district) '.nuts3Name') maps.nuts-lookup.district)}}},
        "region_codes": {
          "district": {{{stringify (dot (concat feature.attributes.wd17cd '.districtCode') maps.county-lookup.district)}}},
          "county": {{{stringify (dot (concat feature.attributes.wd17cd '.countyCode') maps.county-lookup.district)}}},
          "nuts_3": {{{stringify (dot (concat (dot (concat feature.attributes.wd17cd '.districtCode') maps.county-lookup.district) '.nuts3Code') maps.nuts-lookup.district)}}}
        },
        "point": {
          "lat": {{{stringify feature.attributes.lat}}},
          "lon": {{{stringify feature.attributes.long}}}
        }
      }`,*/
    },
    {
      type: 'place',
      dataUrl: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/IPN_GB_2016/FeatureServer/0/query?where=descnm%20like%20%27%25LOC%25%27&outFields=place15cd,place15nm,popcnt,ctry15nm,hlth12nm,lad15cd,lad15nm,pcon15cd,pcon15nm,lat,long&returnGeometry=false&outSR=4326&f=json',
      dataType: 'geojson',
      paging: true,
      indexTemplate: `{
        "id": {{{stringify feature.attributes.place15cd}}},
        "display": {{{stringify (concat feature.attributes.place15nm (if (compare feature.attributes.place15nm "!==" (replace feature.attributes.lad15nm "City of " "")) (concat ", " (replace feature.attributes.lad15nm "City of " ""))))}}},
        "place": {{{stringify feature.attributes.place15nm}}},
        "population": {{feature.attributes.popcnt}},
        "region": {{{stringify feature.attributes.hlth12nm}}},
        "district": {{{stringify feature.attributes.lad15nm}}},
        "textbag": {{{stringify (concat feature.attributes.place15nm " " feature.attributes.lad15nm)}}},
        "autocomplete": {{{stringify (concat feature.attributes.place15nm " " feature.attributes.lad15nm)}}},
        "country": {{{stringify feature.attributes.ctry15nm}}},
        "point": {
          "lat": {{{stringify feature.attributes.lat}}},
          "lon": {{{stringify feature.attributes.long}}}
        }
      }`,
      mapsTemplate: `{
        "constituency": {
          {{#ifAll feature.attributes.pcon15cd feature.attributes.pcon15nm}}
            {{{stringify feature.attributes.pcon15cd}}}: {{{stringify feature.attributes.pcon15nm}}},
            {{{stringify feature.attributes.pcon15nm}}}: {{{stringify feature.attributes.pcon15cd}}}
          {{/ifAll}}
        }
      }`
    }
    /* * /
    {
      type: 'postcode',
      dataUrl: 'https://ons-inspire.esriuk.com/arcgis/rest/services/Postcodes/ONS_Postcode_Directory_Latest_Centroids/MapServer/0/query?where=1%3D1&outFields=pcds,oslaua,ctry,osward,pcon,lat,long&returnGeometry=false&outSR=4326&f=json',
      dataType: 'geojson',
      paging: true,
      indexTemplate: `{
        "id": {{{stringify feature.attributes.pcds}}},
        "display": {{{stringify (concat feature.attributes.pcds ", " (dot feature.attributes.oslaua maps.district))}}},
        "place": {{{stringify feature.attributes.pcds}}},
        "textbag": {{{stringify feature.attributes.pcds}}},
        "autocomplete": {{{stringify (replace feature.attributes.pcds " " "")}}},
        "district": {{{default (stringify (dot feature.attributes.oslaua maps.district)) "null"}}},
        "ward": {{{default (stringify (dot feature.attributes.osward maps.ward)) "null"}}},
        "constituency": {{{default (stringify (dot feature.attributes.pcon maps.place.constituency)) "null"}}},
        "nuts_3": {{{default (stringify (dot (concat feature.attributes.oslaua ".nuts3Name") maps.nuts-lookup.district)) "null"}}},
        "country": "{{#compare feature.attributes.ctry "===" "S92000003"}}Scotland{{/compare}}",
        "region_codes": {
          "district": {{{stringify feature.attributes.oslaua}}},
          "ward": {{{stringify feature.attributes.osward}}},
          "constituency": {{{stringify feature.attributes.pcon}}},
          "nuts_3": {{{default (stringify (dot (concat feature.attributes.oslaua ".nuts3Code") maps.nuts-lookup.district)) "null"}}}
        },
        "point": {
          "lat": {{{stringify feature.attributes.lat}}},
          "lon": {{{stringify feature.attributes.long}}}
        }
      }`
    }
    /*
    {
      type: 'nhs-scotland',
      dataUrl: 'http://sedsh127.sedsh.gov.uk/Atom_data/ScotGov/ZippedShapefiles/SG_NHS_HealthBoards_2018.zip',
      dataType: 'zipped-shapefile',
      shapeFilename: 'SG_NHS_HealthBoards_2018.shp',
      geoJsonReduce: 20,
      unkinkPolygon: true,
      idProperty: 'HBCode',
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
      type: 'district',
      dataUrl: 'https://opendata.arcgis.com/datasets/593018bf59ab4699b66355bd33cd186d_4.geojson',
      dataType: 'geojson',
      geoJsonReduce: 2,
      idProperty: 'lad18cd',
      unkinkPolygon: true,
      indexTemplate: `{
        "id": {{{stringify feature.properties.lad18cd}}},
        "display": {{{stringify feature.properties.lad18nm}}},
        "place": {{{stringify feature.properties.lad18nm}}},
        "textbag": {{{stringify feature.properties.lad18nm}}},
        "autocomplete": {{{stringify feature.properties.lad18nm}}},
        "point": {
          "lat": {{{stringify feature.properties.lat}}},
          "lon": {{{stringify feature.properties.long}}}
        },
        "shape": {{{stringify feature.geometry}}}
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
      geoJsonReduce: 2,
      idProperty: 'nhser18cd',
      unkinkPolygon: true,
      indexTemplate: `{
        "id": {{{stringify feature.properties.nhser18cd}}},
        "display": {{{stringify feature.properties.nhser18nm}}},
        "place": {{{stringify feature.properties.nhser18nm}}},
        "textbag": {{{stringify feature.properties.nhser18nm}}},
        "autocomplete": {{{stringify feature.properties.nhser18nm}}},
        "point": {
          "lat": {{{stringify feature.properties.lat}}},
          "lon": {{{stringify feature.properties.long}}}
        },
        "shape": {{{stringify feature.geometry}}}
      }`
    },
    {
      type: 'nhs-wales',
      dataUrl: 'https://opendata.arcgis.com/datasets/87e71b2c79fc4ac894eeb79359cda131_4.geojson',
      dataType: 'geojson',
      geoJsonReduce: 2,
      idProperty: 'lhb16cd',
      unkinkPolygon: true,
      indexTemplate: `{
        "id": {{{stringify feature.properties.lhb16cd}}},
        "display": {{{stringify feature.properties.lhb16nm}}},
        "place": {{{stringify feature.properties.lhb16nm}}},
        "textbag": {{{stringify feature.properties.lhb16nm}}},
        "autocomplete": {{{stringify feature.properties.lhb16nm}}},
        "point": {
          "lat": {{{stringify feature.properties.lat}}},
          "lon": {{{stringify feature.properties.long}}}
        },
        "shape": {{{stringify feature.geometry}}}
      }`
    },
    {
      type: 'ward',
      dataUrl: 'https://opendata.arcgis.com/datasets/07194e4507ae491488471c84b23a90f2_3.geojson',
      dataType: 'geojson',
      geoJsonReduce: 2,
      idProperty: 'wd17cd',
      unkinkPolygon: true,
      indexTemplate: `{
        "id": {{{stringify feature.properties.wd17cd}}},
        "display": {{{stringify feature.properties.wd17nm}}},
        "place": {{{stringify feature.properties.wd17nm}}},
        "textbag": {{{stringify feature.properties.wd17nm}}},
        "autocomplete": {{{stringify feature.properties.wd17nm}}},
        "point": {
          "lat": {{{stringify feature.properties.lat}}},
          "lon": {{{stringify feature.properties.long}}}
        },
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
      geoJsonReduce: 2,
      idProperty: 'nuts318cd',
      unkinkPolygon: true,
      indexTemplate: `{
        "id": {{{stringify feature.properties.nuts318cd}}},
        "display": {{{stringify feature.properties.nuts318nm}}},
        "place": {{{stringify feature.properties.nuts318nm}}},
        "textbag": {{{stringify feature.properties.nuts318nm}}},
        "autocomplete": {{{stringify feature.properties.nuts318nm}}},
        "point": {
          "lat": {{{stringify feature.properties.lat}}},
          "lon": {{{stringify feature.properties.long}}}
        },
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
    }*/
  ]
}