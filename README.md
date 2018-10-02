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
| point | `geo_point` | The latitude and longitude of the place | '{ lat: 51.45238876, lon: -0.20021001 }`, `{ lat: 55.959724, lon: -3.190456 }` |
| shape | `geo_shape` | If there is shape data provided this will be stored here. geoJSON is preferred | n/a |

## Data sources
###
