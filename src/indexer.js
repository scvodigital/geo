const fs = require('fs');
const path = require('path');
const MultiProgress = require('multi-progress');
const elasticsearch = require('elasticsearch');
const dateFns = require('date-fns');

class Indexer {
  constructor(config, multi) {
    this.config = config;
    this.host = config.host;
    this.index = config.index;
    this.pageSize = config.pageSize;
    this.fresh = config.fresh || false;
    this.cooldown = config.cooldown || 10000;
    this.queue = [];
    this.indexing = false;
    this.ticker = null;
    this.startIndex = config.startIndex;
    this.progressBar = multi.newBar('    Index queue: [:bar] :percent | :current/:total', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: 0
    });
    if (this.startIndex > 0) {
      this.skipBar = multi.newBar('    Skipping items: [:bar] :percent | :current/:total', {
        complete: '=',
        incomplete: ' ',
        width: 50,
        total: this.startIndex
      });
    }
    this.failedBar = multi.newBar('    So far failed to index :current document(s)', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: 0
    });
    this.total = 0;
    this.skipped = 0;
    this.indexed = 0;
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
        index: this.index,
        body: geoBody
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
      documents.push(document);
    }
    //console.log('Page document count:', documents.length, '| Page size', currentPageSize, '| Documents still in queue', this.queue.length);
    if (documents.length > 0) {
      await this.indexDocuments(documents);
    }
  }

  push(documents) {
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
    const bulkParams = { body: [] };

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
      //console.log('Bulk index finished on', documents.length, 'documents. Errors:', indexResponse.errors && indexResponse.errors.length || '0');
      this.indexed += documents.length;
      this.progressBar.tick(documents.length);

      if (indexResponse.errors) {
        await this.recordFailedDocuments(documents, indexResponse);
      }

      this.indexing = false;
    } catch(err) {
      await this.recordFailedDocuments(documents, err);
      this.indexing = false;
    }
  }

  createDocument(type, id, places, lat, lon, shape = null, parent = null) {
    places = Array.isArray(places) 
      ? places.filter(place => { return !!place && place !== ' '; }) 
      : [places];
    const document = {
      head: { 
        index: { 
          _index: this.index, 
          _type: type, 
          _id: id 
        } 
      },
      body: {
        Id: id,
        place: places,
        textbag: places.join(' '),
        point: {
          lat: lat,
          lon: lon
        }
      }
    };
    if (shape) {
      document.body.shape = shape;
    }
    if (parent) {
      document.head.index.parent = parent;
    }
    
    return document;
  } 

  async recordFailedDocuments(documents, reason) {
    this.failedBar.tick(documents.length);

    const timestamp = dateFns.format(new Date(), 'YYYY-MM-DD-HH-mm-ss-SS');
    const filename = timestamp + '.json';
    const failObject = {
      documents: documents,
      reason: reason
    };
    const failJson = JSON.stringify(failObject, null, 4);
    fs.writeFileSync(path.join(this.failedDirectory, filename), failJson);
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
    
const geoBody = {
  settings: {
    analysis: {
      analyzer: {
        autocomplete: {
          tokenizer: "autocomplete",
          filter: [
            'lowercase'
          ]
        },
        autocomplete_search: {
          tokenizer: "lowercase"
        }
      },
      tokenizer: {
        autocomplete: {
          type: "edge_ngram",
          min_gram: 3,
          max_gram: 10,
          token_chars: [
            "letter"
          ]
        }
      }
    }
  },
  mappings: {
    'local-authority-district': {
      properties: {
        place: {
          type: 'keyword'
        },
        textbag: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'autocomplete_search'
        },
        point: {
          type: 'geo_point'
        },
        shape: {
          type: 'geo_shape',
          tree: 'quadtree',
          precision: '50m'
        }
      }
    },
    'electoral-ward': {
      properties: {
        place: {
          type: 'keyword'
        },
        textbag: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'autocomplete_search'
        },
        point: {
          type: 'geo_point'
        },
        shape: {
          type: 'geo_shape',
          tree: 'quadtree',
          precision: '50m'
        }
      }
    },
    'nuts-level-2': {
      properties: {
        place: {
          type: 'keyword'
        },
        textbag: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'autocomplete_search'
        },
        point: {
          type: 'geo_point'
        },
        shape: {
          type: 'geo_shape',
          tree: 'quadtree',
          precision: '50m'
        }
      }
    },
    'postcode': {
      properties: {
        place: {
          type: 'keyword'
        },
        textbag: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'autocomplete_search'
        },
        point: {
          type: 'geo_point'
        },
        shape: {
          type: 'geo_shape',
          tree: 'quadtree',
          precision: '50m'
        },
        district: {
          type: 'keyword'
        },
        ward: {
          type: 'keyword'
        },
        nuts: {
          type: 'keyword'
        }
      }
    }
  }
};
