const elasticsearch = require('elasticsearch');
class Indexer {
  constructor(config) {
    this.config = config;
    this.host = config.host;
    this.index = config.index;
    this.pageSize = config.pageSize;
    this.tickerInterval = config.tickerInterval;
    this.fresh = config.fresh || false;
    this.queue = [];
    this.ticker = null;
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
      process.exist();
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

    console.log('Indexer ready');
  }

  async tick() {
    const length = this.queue.length;
    if (length > 0) {
      const timeRemaining = Math.round((((length / this.pageSize) * this.tickerInterval) / 1000) * 100) / 100;
      console.log('INDEXER TICK -> Queue size:', length, '| Approximately', timeRemaining, 'seconds left'); 
      const page = this.queue.splice(0, this.pageSize);
      if (page.length > 0) {
        try {
          await this.indexDocuments(page);
        } catch(err) {
          console.error('Failed to index documents', err);
        }
      }
    } else {
      console.log('Nothing left in queue, turning ticker off until there is');
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  push(documents) {
    this.queue.push(...documents);
    if (!this.ticker) {
      this.ticker = setInterval(async () => {
        this.tick();
      }, this.tickerInterval);
    }
  }

  async indexDocuments(documents) {
    const bulkParams = { body: [] };
    for (const document of documents) {
      bulkParams.body.push(document.head);
      bulkParams.body.push(document.body);      
    }

    try {
      const indexResponse = await this.client.bulk(bulkParams);
      console.log('Bulk index finished on', documents.length, 'documents. Total errors:', indexResponse.errors && indexResponse.errors.length || 'none');
    } catch(err) {
      console.log('Index failure:', JSON.stringify(documents, null, 4));
      throw err;
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
