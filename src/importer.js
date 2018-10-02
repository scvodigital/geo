const elasticsearch = require('elasticsearch');
const secrets = require('../secrets.js');

const index = 'geo';

class Importer {
  constructor(type, parent) {
    this.type = type;
    this.parent = parent;
    this.queue = [];
    console.log('Importer loaded:', this.config);
  }

  async setup() {
    this.client = new elasticsearch.Client({
      host: secrets.eshost,
      apiVersion: '5.6' 
    });

    if (this.parent) {
      geoBody.mappings[this.type]._parent = {
        type: this.parent
      };
    }

    //await this.client.indices.delete({ index: index });

    const existsParams = {
      index: index
    };
    const exists = await this.client.indices.exists(existsParams);
    console.log('Index exists?', exists);
    
    if (!exists) {
      const createParams = {
        index: index,
        body: geoBody
      };
      const createResponse = await this.client.indices.create(createParams);
      console.log('Create index response:', createResponse);
    }

    this.ticker = setInterval(async () => {
      this.tick();
    }, 500);
  }

  async tick() {
    console.log('IMPORTER QUEUE:', this.queue.length);
    const page = this.queue.splice(0, 500);
    if (page.length > 0) {
      await this.index(page);
    }
  }

  push(documents) {
    this.queue.push(...documents);
  }

  async index(documents) {
    const bulkParams = { body: [] };
    for (const document of documents) {
      const head = {
        index: {
          _index: index,
          _type: this.type,
          _id: document.Id
        }
      };
      if (document.parent) {
        head.index.parent = document.parent;
      };
      bulkParams.body.push(head);
      bulkParams.body.push(document);      
    }

    const indexResponse = await this.client.bulk(bulkParams);
  }
}

module.exports = { Importer };
    
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
        }
      },
      _routing: {
        required: true
      },
      _parent: {
        type: 'local-authority-district'
      }
    }
  }
};
