# @scvo/geo

## Introduction
The goal behind this project is to collate a set of data sources and create a set of rules for
transforming these data sets into a simple re-usable search index that can be used to geo code 
objects and as a location autocompleter.

# The Elasticsearch index
The data will sit in a single Elasticsearch index with the following mapping:

| Property | Type | Description | Examples |
| --- | --- | --- | --- |
| Id | n/a | The Elasticsearch Id will take on the Ids given in the datasource or the name of the place if it is unique (a postcode) | `E09000032`, `EH3 6BB` |
| name | `keyword` | This is an array of terms used to describe or find the object | `Wandsworth`, `EH3 6BB` |
| point | `geo_point` | The latitude and longitude of the place | `{ lat: 51.45238876, lon: -0.20021001 }`, `{ lat: 55.959724, lon: -3.190456 }` |
| shape | `geo_shape` | If there is shape data provided this will be stored here | n/a |

## Data sources

| Location type | Source | Name | Latest | Data | ES Type |
| --- | --- | --- | --- | --- | --- |
| Local authority districts | Office for National Statistics | [Local Authority Districts (May 2018) UK BUC](http://geoportal.statistics.gov.uk/datasets/local-authority-districts-may-2018-uk-buc) | 2018-10-02 | [GeoJSON](https://opendata.arcgis.com/datasets/593018bf59ab4699b66355bd33cd186d_4.geojson) | `local-authority-districts` |
| Electoral Wards | Office for National Statistics | [Wards (December 2017) Generalised Clipped Boundaries in Great Britain](http://geoportal.statistics.gov.uk/datasets/wards-december-2017-generalised-clipped-boundaries-in-great-britain) | 2018-10-02 | [GeoJSON](https://opendata.arcgis.com/datasets/07194e4507ae491488471c84b23a90f2_2.geojson) | `electoral-wards` |
| NUTS Level 2 | Office for National Statistics | [NUTS Level 2 (January 2018) GEneralised Clipped Boundaries in the United Kingdom](http://geoportal.statistics.gov.uk/datasets/nuts-level-2-january-2018-generalised-clipped-boundaries-in-the-united-kingdom) | 2018-10-02 | [GeoJSON](https://opendata.arcgis.com/datasets/48b6b85bb7ea43699ee85f4ecd12fd36_2.geojson) | nuts-level-2 |

All data imports should be run in order when run on an empty index.

### Local Authority Districts
[Info about import and transform process here]

### Electoral Wards
[Info about import and transform process here]

### NUTS Level 2
[Info about import and transform process here]
