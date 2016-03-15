'use strict'

var fs = require('fs')
var express = require('express')
var htmlProcess = require('./html_process')
var through = require('through2')
var elasticsearch = require('elasticsearch')
var bodyParser = require('body-parser')


function oparlType(type) {
  return `https://oparl.org/schema/1.0/${type}`
}

const SEARCH_TYPES = ['Meeting', 'Paper', 'File']


function toHitsSources(result) {
  return result.hits.hits.map(hit => hit._source)
}

class API {
  constructor(conf) {
    this.conf = conf
    this.elasticsearch = new elasticsearch.Client({
      host: conf.elasticsearchUrl,
      log: 'info'
    })
  }

  getDocFragments(docId, res) {
    res.writeHead(200, {
      'Content-Type': 'application/json'
    })

    let htmlPath = this.conf.getHtmlPath(docId)
    console.log(`Processing ${docId}: ${htmlPath}`)
    fs.createReadStream(htmlPath)
      .on('error', e => {
        console.log("File error:", e.stack || e)
        res.end()
      })
      .pipe(htmlProcess())
      .pipe(toJsonArray())
      .pipe(res)
      .on('error', e => {
        console.log("Error:", e.stack || e)
        res.end()
      })
  }

  get(type, id, res) {
    this.elasticsearch.get({
      index: 'oparl',
      type: type,
      id: id
    }).then(result => {
      res.writeHead(200, {
        'Content-Type': 'application/json'
      })
      res.write(JSON.stringify(result._source))
      res.end()
    }, err => {
      console.log("ES get:", err.stack)
      if (err.message == "Not Found") {
        res.writeHead(404, {
          'Content-Type': 'application/json'
        })
        res.write(JSON.stringify({ error: err.message }))
      } else {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        })
        res.write(err.message.toString())
      }
      res.end()
    })
  }

  _search(body, res, mapper) {
    this.elasticsearch.search({
      index: 'oparl',
      body: body
    }).then(result =>
      mapper ? mapper(result) : result
    ).then(body => {
      res.writeHead(200, {
        'Content-Type': 'application/json'
      })
      res.write(JSON.stringify(body))
      res.end()
    }, err => {
      console.log("ES search:", err.stack)
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      })
      res.write(err.message.toString())
      res.end()
    })
  }

  searchDocs(queryString, res) {
    let query = queryString ? {
      query_string: {
        default_operator: 'AND',
        analyze_wildcard: true,
        query: queryString
      }
    } : {
      match_all: {}
    }
    this._search({
      query: {
        bool: {
          must: query,
          filter: {
            or: SEARCH_TYPES.map(type => {
              return {
                type: {
                  value: type
                }
              }
            })
          }
        }
      },
      sort: [
        { _score: "desc" },  // ES scoring
        { publishedDate: "desc" },  // type Paper
        { start: "desc" }  // type Meeting
        // { date: "desc" }  // type File
      ]
    }, res, toHitsSources)
  }

  findFileContext(id, res) {
    this._search({
      query: {
        or: [{
          match: {
            invitation: id
          }
        }, {
          match: {
            resultsProtocol: id
          }
        }, {
          match: {
            verbatimProtocol: id
          }
        }, {
          match: {
            auxiliaryFile: id
          }
        }, {
          match: {
            resolutionFile: id
          }
        }, {
          match: {
            mainFile: id
          }
        }]
      }
    }, res, toHitsSources)
  }

  findPaperContext(id, res) {
    // TODO: doesn't work at all
    this._search({
      query: {
        nested: {
          path: "agendaItem",
          query: {
            bool: {
              must: {
                match: {
                  "agendaItem.consultation.parentID": id
                }
              }
            }
          }
        }
      }
    }, res, toHitsSources)
  }

  indexAnnotation(req, cb) {
    req.index = 'annotations'
    req.type = 'text'
    this.elasticsearch.index(req, (err, res) => {
      cb(err, res && res._id)
    })
  }
}


module.exports = function(conf) {
  let api = new API(conf)
  var app = express()

  app.use(bodyParser.json())

  app.get('/search/', (req, res) => {
    api.searchDocs("", res)
  })
  app.get('/search/:query*', (req, res) => {
    api.searchDocs(req.params.query, res)
  })
  app.get('/oparl/file/:id', (req, res) => {
    api.get('File', req.params.id, res)
  })
  app.get('/oparl/paper/:id', (req, res) => {
    api.get('Paper', req.params.id, res)
  })
  app.get('/oparl/meeting/:id', (req, res) => {
    api.get('Meeting', req.params.id, res)
  })
  app.get('/oparl/person/:id', (req, res) => {
    api.get('Person', req.params.id, res)
  })
  app.get('/oparl/organization/:id', (req, res) => {
    api.get('Organization', req.params.id, res)
  })
  app.get('/oparl/file/:id/context', (req, res) => {
    api.findFileContext(req.params.id, res)
  })
  app.get('/oparl/paper/:id/context', (req, res) => {
    api.findPaperContext(req.params.id, res)
  })
  app.get('/file/:id/fragments', (req, res) => {
    api.getDocFragments(req.params.id, res)
  })
  app.post('/file/:id/annotations', (req, res) => {
    let annotation = req.body
    annotation.file = req.params.id
    req.body.created = new Date().toISOString()
    // Yield control over id to ElasticSearch
    delete annotation.id
    delete annotation._id

    
    api.indexAnnotation({ body: annotation }, (err, annotationId) => {
      if (err) {
        console.error(err.stack || err.message)
        res.writeHead(500, {
          'Content-Type': 'application/json'
        })
        res.write(JSON.stringify({ error: "addAnnotation" }))
        res.end()
        return
      }

      console.log(`File ${req.params.id}: created annotation ${annotationId}`)
      res.writeHead(201, "Created", {
        'Content-Type': 'application/json',
        Location: `/file/${req.params.id}/annotations/${annotationId}`
      })
      res.write(JSON.stringify({ id: annotationId }))
      res.end()
    })
  })
  app.put('/file/:id/annotations/:annotationId', (req, res) => {
    let annotation = req.body
    annotation.id = req.params.annotationId
    annotation.file = req.params.id
    req.body.updated = new Date().toISOString()

    api.indexAnnotation({
      id: annotation.id,
      body: annotation
    }, err => {
      if (err) {
        console.error(err.stack || err.message)
        res.writeHead(500, {
          'Content-Type': 'application/json'
        })
        res.write(JSON.stringify({ error: "updateAnnotation" }))
        res.end()
        return
      }

      console.log(`File ${req.params.id}: updated annotation ${annotation.id}`)
      res.writeHead(204, "No Content")
      res.end()
    })
  })

  // Catch all: 404
  app.use((req, res) => {
    res.writeHead(404, {
      'Content-Type': 'application/json'
    })
    res.write(JSON.stringify({ error: "Not found" }))
    res.end()
  })

  return app
}

function toJsonArray() {
  let count = 0
  return through.obj(function(fragment, enc, cb) {
    count++

    if (count === 1) {
      this.push("[\n")
    } else {
      this.push(",\n")
    }
    this.push(JSON.stringify(fragment))

    cb()
  }, function(cb) {
    this.push("\n]")
    cb()
  })
}

// SHIM for Object.values()
function objectValues(obj) {
  return Object.keys(obj).map(k => obj[k])
}
