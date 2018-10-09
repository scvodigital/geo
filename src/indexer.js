const fs = require('fs');
const path = require('path');
const MultiProgress = require('multi-progress');
const elasticsearch = require('elasticsearch');
const dateFns = require('date-fns');
const s = require('string');
const deepmerge = require('deepmerge');

class Indexer {
  constructor(config, multi) {
    this.config = config;
    this.host = config.host;
    this.index = config.index;
    this.pageSize = config.pageSize || 10000;
    this.fresh = config.fresh || false;
    this.cooldown = config.cooldown || 10000;
    this.timeout = config.timeout || '5m';
    this.queue = [];
    this.indexing = false;
    this.ticker = null;
    this.startIndex = config.startIndex;
    this.progressBar = multi.newBar('Index queue: [:bar] :percent | :current/:total', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: 0
    });
    if (this.startIndex > 0) {
      this.skipBar = multi.newBar('Skipping items: [:bar] :percent | :current/:total', {
        complete: '=',
        incomplete: ' ',
        width: 50,
        total: this.startIndex
      });
    }
    this.failedBar = multi.newBar('So far failed to index :current document(s)', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: 0
    });
    this.total = 0;
    this.skipped = 0;
    this.indexed = 0;
    this.failedDocuments = [];
  }

  async setup() {
    console.log('Setting up indexer with following config:', JSON.stringify(this.config, null, 4));

    this.client = new elasticsearch.Client({
      host: this.host,
      apiVersion: '5.6' 
    });

    const existsParams = { index: this.index };
    let exists = false;
    try {
      console.log('Checking to see if index "' + this.index + '" already exists');
      exists = await this.client.indices.exists(existsParams);
      console.log('Index', !exists ? 'does not exist' : 'already exists');
    } catch(err) {
      console.error('Failed to check if index exists', existsParams, err);
      process.exit();
    }
   
    if (exists && this.fresh) {
      const deleteParams = { index: this.index };
      try {
        console.log('Deleting index "' + this.index + '"');
        await this.client.indices.delete(deleteParams);
        console.log('Index deleted');
        exists = false;
      } catch(err) {
        console.error('Failed to delete index', deleteParams, err);
        process.exit();
      }
    }

    if (!exists) {
      const createParams = {
        index: this.index
      };
      try {
        console.log('Creating index "' + this.index + '"');
        const createResponse = await this.client.indices.create(createParams);
        console.log('Index created');
      } catch(err) {
        console.error('Failed to create index', createParams, err);
        process.exit();
      }
    }

    const timestamp = dateFns.format(new Date(), 'YYYY-MM-DD-HH-mm-ss');
    this.failedDirectory = path.join(__dirname, '../data/failed-' + timestamp);
    console.log('Creating directory for documents that fail to index at', this.failedDirectory);
    fs.mkdirSync(this.failedDirectory);

    console.log('Indexer ready');
  }

  startIndexer() {
    if (this.ticker) return;
    console.log('Starting indexer\n\n\n\n\n\n\n');
    this.ticker = setInterval(async () => {
      await this.tick();
    }, 0);
  }

  async tick() {
    if (this.indexing || this.queue.length === 0) return;
    let currentPageSize = 0;
    const documents = [];
    while (this.queue.length > 0 && currentPageSize < this.pageSize) {
      const document = this.queue.shift();
      const documentSize = JSON.stringify(document).length;
      currentPageSize += documentSize;
      if (currentPageSize > this.pageSize) break;
      documents.push(document);
    }
    //console.log('Page document count:', documents.length, '| Page size', currentPageSize, '| Documents still in queue', this.queue.length);
    if (documents.length > 0) {
      await this.indexDocuments(documents);
    }
  }

  push(documents) {
    documents = documents.filter(document => Boolean);
    if (this.startIndex <= this.skipped + documents.length) {
      if (this.skipBar && this.skipBar.current < this.startIndex) {
        this.skipBar.tick(this.startIndex - this.skipBar.current);
      }
      this.total += documents.length;
      this.progressBar.total = this.total;
      this.queue.push(...documents);
    } else {
      this.skipped += documents.length;
      this.skipBar.tick(documents.length);
    }
  }

  async indexDocuments(documents) {
    this.indexing = true;
    const bulkParams = {
      timeout: this.timeout,
      body: [] 
    };

    try {
      for (const document of documents) {
        bulkParams.body.push(document.head);
        bulkParams.body.push(document.body);      
      }
    } catch (err) {
      console.error('Problem preparing bulk index body', err);
      return;
    }

    try {
      const indexResponse = await this.client.bulk(bulkParams);

      this.indexed += documents.length;
      this.progressBar.tick(documents.length);

      if (indexResponse.errors) {
        const failed = [];
        for (const item of indexResponse.items) {
          const error = item.index.error;
          if (error && !error.caused_by.reason.startsWith('illegal lat')) {
            const id = item.index._id;
            for (const document of documents) {            
              if (id === document.body.id) {
                document.reason = error;
                failed.push(document);
              }
            }
          }
        }
        await this.recordFailedDocuments(failed);
      }

      this.indexing = false;
    } catch(err) {
      const failedDocuments = [];
      for (const document of documents) {
        document.reason = err;
        failedDocuments.push(document);
      }
      await this.recordFailedDocuments(failedDocuments);
      this.indexing = false;
    }
  }

  async recordFailedDocuments(documents) {
    try {
      this.failedBar.tick(documents.length);
      this.failedDocuments.push(...documents);
      const failJson = JSON.stringify(this.failedDocuments, null, 2);    
      fs.writeFileSync(path.join(this.failedDirectory, 'recovery.json'), failJson);
    } catch(err) {
      console.error('Failed to backup failed documents', err);
    }
    await this.sleep(this.cooldown);
  }

  sleep(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }
}

module.exports = { Indexer };
    
const indexTemplate = {
  "template": "geo*",
  "settings": {
    "analysis": {
      "filter": {
        "locations_stop": {
          "type": "stop",
          "stopwords": [
            "city",
            "of"
          ]
        },
        "my_snow": {
          "type": "snowball",
          "language": "English"
        },
        "english_stop": {
          "type": "stop",
          "stopwords": "_english_"
        }
      },
      "analyzer": {
        "my_analyzer": {
          "filter": [
            "lowercase",
            "my_snow"
          ],
          "type": "custom",
          "tokenizer": "standard"
        },
        "my_stop_analyzer": {
          "filter": [
            "lowercase",
            "english_stop",
            "my_snow"
          ],
          "type": "custom",
          "tokenizer": "standard"
        },
        "autocomplete": {
          "filter": [
            "lowercase",
            "locations_stop"
          ],
          "tokenizer": "autocomplete"
        },
        "autocomplete_search": {
          "filter": [
            "shingle"
          ],
          "type": "custom",
          "tokenizer": "standard"
        }
      },
      "tokenizer": {
        "autocomplete": {
          "token_chars": [
            "letter",
            "digit",
            "whitespace",
            "punctuation"
          ],
          "min_gram": "3",
          "type": "edge_ngram",
          "max_gram": "10"
        }
      }
    }
  },
  "mappings": {
    "_default_": {
      "_all": {
        "enabled": false
      },
      "dynamic_templates": [
        {
          "strings": {
            "match_mapping_type": "string",
            "mapping": {
              "type": "keyword"
            }
          }
        }
      ],
      "properties": {
        "autocomplete": {
          "type": "text",
          "analyzer": "autocomplete",
          "search_analyzer": "autocomplete_search"
        },
        "textbag": {
          "search_analyzer": "snowball",
          "search_quote_analyzer": "snowball",
          "analyzer": "snowball",
          "store": false,
          "type": "text"
        },
        "point": {
          "type": "geo_point"
        },
        "shape": {
          "type": "geo_shape",
          "tree": "quadtree",
          "precision": "50m"
        }
      }
    }
  }
}
