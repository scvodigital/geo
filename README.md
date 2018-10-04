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
| place | `keyword` | The full name  used to describe or find the object | `Wandsworth`, `EH3 6BB` |
| textbag | `text` | Used for partial matches | n/a |
| point | `geo_point` | The latitude and longitude of the place | `{ lat: 51.45238876, lon: -0.20021001 }`, `{ lat: 55.959724, lon: -3.190456 }` |
| shape | `geo_shape` | If there is shape data provided this will be stored here | n/a |

## Data sources

| Location type | Source | Name | Latest | Data | ES Type |
| --- | --- | --- | --- | --- | --- |
| Local authority districts | Office for National Statistics | [Local Authority Districts (May 2018) UK BUC](http://geoportal.statistics.gov.uk/datasets/local-authority-districts-may-2018-uk-buc) | 2018-10-02 | [GeoJSON](https://opendata.arcgis.com/datasets/593018bf59ab4699b66355bd33cd186d_4.geojson) | `local-authority-district` |
| Electoral Wards | Office for National Statistics | [Wards (December 2017) Generalised Clipped Boundaries in Great Britain](http://geoportal.statistics.gov.uk/datasets/07194e4507ae491488471c84b23a90f2_3) | 2018-10-02 | [GeoJSON](https://opendata.arcgis.com/datasets/07194e4507ae491488471c84b23a90f2_3.geojson) | `electoral-ward` |
| NUTS Lookup | TBC | [Local Authority District (December 2016) to NUTS3 to NUTS2 to NUTS1 (January 2018) Lookup in United Kingdom](http://opendata.esriuk.com/datasets/ons::local-authority-district-december-2016-to-nuts3-to-nuts2-to-nuts1-january-2018-lookup-in-united-kingdom) | 2018-10-02 | [GeoJSON](https://opendata.arcgis.com/datasets/2a2548641a294734ba4fdb689b12d955_0.geojson) | Not indexed |
| NUTS Level 2 | Office for National Statistics | [NUTS Level 2 (January 2018) Super Generalised Clipped Boundaries in the United Kingdom](http://geoportal.statistics.gov.uk/datasets/07194e4507ae491488471c84b23a90f2_3) | 2018-10-02 | [GeoJSON](https://opendata.arcgis.com/datasets/48b6b85bb7ea43699ee85f4ecd12fd36_3.geojson) | `nuts-level-2` |
| Postcodes | Office for National Statistics | [ONS Postcode Directory (Latest) Centroids](http://geoportal.statistics.gov.uk/datasets/ons-postcode-directory-latest-centroids) | 2018-10-02 | [CSV](https://opendata.arcgis.com/datasets/75edec484c5d49bcadd4893c0ebca0ff_0.csv?session=undefined&outSR=%7B%22wkid%22%3A27700%2C%22latestWkid%22%3A27700%7D) | `postcode` |

