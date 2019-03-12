# @scvo/geo

## Introduction
The goal behind this project is to collate a set of data sources and create a set of rules for
transforming these data sets into a simple re-usable search index that can be used to geo code 
objects and as a location autocompleter.

## OS Data Source
The OS place names data can be [requested here](https://www.ordnancesurvey.co.uk/opendatadownload/products.html#OPNAME). Once downloaded you will need to extract the `DATA` directory to `./os-data`. The places import can be run using `npm run places`

## Districts Data Source
The districts or UK Subdivisions data can be [found here](https://maps.elastic.co). Once downloaded should be stored here `./data/uk_subdivisions_v1.geo.json` 

## Postcode Districts (Outcodes)
The postcode districts data can be [found here](https://www.doogal.co.uk/PostcodeDistrictsCSV.ashx). Once downloaded store it here `./data/postcode-districts.csv`