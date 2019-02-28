let AWS = require('aws-sdk');
AWS.config.update({
  credentials: new AWS.Credentials(process.env.ACCESS_KEY_ID, process.env.SECRET_ACCESS_KEY),
  region: process.env.AWS_REGION
});
const util = require('util');

function createResponse(status, body) {
  return {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    statusCode: status,
    body: JSON.stringify(body)
  }
}

exports.esReviewSearchHandler = function(event, context, callback) {
    var msg;

    console.log(event); // Contains incoming request data (e.g., query params, headers and more)

    if (!event.queryStringParameters || !event.queryStringParameters.hasOwnProperty('searchText')) {
        msg = "Missing Required Query String Parameter searchText";
        console.error(msg); 
        return callback(null, createResponse(404, {"message": msg}))
    }

    var es = require('elasticsearch').Client({
      hosts: [ process.env.ES_ENDPOINT ],
      connectionClass: require('http-aws-es')
    });

    es.ping({}, function(err) {
        if (err) {
            msg = "Unable to connect to elasticsearch, error: " +
                util.inspect(err, {showHidden: false, depth: null});
            console.error(msg); 
            return callback(null, createResponse(502, {"message": msg}))
        }
        es.search({
          index: 'review',
          type: '_doc',
          q: event.queryStringParameters.searchText
        }, function(err, response) {
            if (err) {
                msg = "Elasticsearch error: " +
                    util.inspect(err, {showHidden: false, depth: null});
                console.error(msg); 
                return callback(null, createResponse(502, {"message": msg}))
            }
            var results = []
            response.hits.hits.forEach(function(hit) {
                results.push({
                    id: hit._source.id,
                    productId: hit._source.productId,
                    numStars: hit._source.numStars,
                    numLikes: hit._source.numLikes,
                    numDislikes: hit._source.numDislikes,
                    reviewText: hit._source.reviewText 
                });
            });
            callback(null, createResponse(200, {"reviews": results}));
        });
    });
}

exports.esProductSearchHandler = function(event, context, callback) {
    var msg;

    console.log(event); // Contains incoming request data (e.g., query params, headers and more)

    if (!event.queryStringParameters || !event.queryStringParameters.hasOwnProperty('searchText')) {
        msg = "Missing Required Query String Parameter searchText";
        console.error(msg); 
        return callback(null, createResponse(404, {"message": msg}))
    }

    var es = require('elasticsearch').Client({
      hosts: [ process.env.ES_ENDPOINT ],
      connectionClass: require('http-aws-es')
    });

    es.ping({}, function(err) {
        if (err) {
            msg = "Unable to connect to elasticsearch, error: " +
                util.inspect(err, {showHidden: false, depth: null});
            console.error(msg); 
            return callback(null, createResponse(502, {"message": msg}))
        }
        es.search({
          index: 'product',
          type: '_doc',
          q: event.queryStringParameters.searchText
        }, function(err, response) {
            if (err) {
                msg = "Elasticsearch error: " +
                    util.inspect(err, {showHidden: false, depth: null});
                console.error(msg); 
                return callback(null, createResponse(502, {"message": msg}))
            }
            var results = []
            response.hits.hits.forEach(function(hit) {
                results.push({
                    id: hit._source.id,
                    description: hit._source.description,
                    numReviews: hit._source.numReviews,
                    inventory: hit._source.inventory
                });
            });
            callback(null, createResponse(200, {"products": results}));
        });
    });
}

