var aws = require("aws-sdk");
const ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
const util = require('util');
const async = require('async');

// DynamoDB Transactions allow 10 objects, so we need to insert an order
//  object and at most update 9 inventory counts.
const MAX_PRODUCTS_PER_ORDER = 9; 

function createResponse(status, body) {
  return {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    statusCode: status,
    body: JSON.stringify(body)
  }
}

function checkProductInventory(product, callback) {
    return function(cb) {
        var msg = null;

        console.log("Begin checkProductInventory for product: " + JSON.stringify(product));

        if (!product.hasOwnProperty('productId')) {
            return cb("Missing Required productId parameter in products array");
        }
        if (!product.hasOwnProperty('count')) {
            return cb("Missing Required count parameter in products array");
        }
        if (!Number.isInteger(product.count)) {
            return cb("Required count parameter in products array is not an integer");
        }
        if (!product.count > 0) {
            return cb("Required count parameter must be greater than zero");
        }
        var params = {
            TableName: process.env.TARGET_DDB_PRODUCT_TABLE,
            Key: {
                'id': {'S': product.productId}
            }
        };
        ddb.getItem(params, function(err, data) {
            if (err) {
                msg = "Error with getItem on product id " + product.productId + ": " + err; 
                console.log(msg);
                return cb(msg);
            }
            console.dir(data);
            if (data.Item.inventory < product.count) {
                msg = "Requested count " + product.count + 
                    " for productId " + product.productId + 
                    "exceeds available inventory of " + data.Item.inventory;; 
                console.log(msg);
                return cb(msg);
            }
            return cb(null);
        });
    }
}

function updateProductInventory(product, callback) {
    return function(cb) {
        var msg = null;

        console.log("Begin updateProductInventory for product: " + JSON.stringify(product));

        var params = buildUpdateProductObject(product);
        ddb.updateItem(params, function(err, data) {
            if (err) {
                msg = "Error with updateItem on product id " + product.productId + ": " + err; 
                console.log(msg);
                return cb(msg);
            }
            return cb(null);
        });
    }
}

function buildUpdateProductObject(product) {
    var params = {
        TableName: process.env.TARGET_DDB_PRODUCT_TABLE,
        Key: {
            'id': {'S': product.productId}
        },
        UpdateExpression: 'SET inventory = inventory - :incr',
        ExpressionAttributeValues: {":incr":{ "N": product.count.toString() } }
    };
    return params;
}

function buildNewOrderObject(id, body) {
    var newOrder = {
        'id' : { 'S' : id },
        'customerName' : { 'S' : body.customerName },
        'customerAddress' : { 'S' : body.customerAddress },
        'orderDate' : { 'S' : new Date().toISOString() },
        'status' : { 'S' : 'placed' },
        'products' : { 'L' : [ ] }
    };
    body.products.forEach(function(product) {
        newOrder.products.L.push({
            'M' : { 
                'productId' : { 'S' : product.productId },
                'count' : { 'N' : product.count.toString() }
            }
        });
    });
    return { TableName: process.env.TARGET_DDB_ORDER_TABLE, Item : newOrder};
}

exports.insertNewDDBOrder = function(event, context, callback) {
    console.log('Received event:', JSON.stringify(event, null, 2));
    var msg = null;

    if (!event.body) {
        msg = "Missing Required JSON Body Object";
        console.error(msg);
        return callback(null, createResponse(404, {"message": msg}))
    }
    var body = JSON.parse(event.body);
    console.dir(body);
    if (!body.hasOwnProperty('customerName')) {
        msg = "Missing Required Body parameter customerName";
        console.error(msg);
        return callback(null, createResponse(404, {"message": msg}))
    }
    if (!body.hasOwnProperty('customerAddress')) {
        msg = "Missing Required Body parameter customerAddress";
        console.error(msg);
        return callback(null, createResponse(404, {"message": msg}))
    }
    if (!body.hasOwnProperty('products')) {
        msg = "Missing Required Body parameter products";
        console.error(msg);
        return callback(null, createResponse(404, {"message": msg}))
    }
    if (!Array.isArray(body.products)) {
        msg = "Required Body parameter products is not an array";
        console.error(msg);
        return callback(null, createResponse(404, {"message": msg}))
    }

    var checkInventoryArray = [];
    body.products.forEach(function(product) {
        checkInventoryArray.push(checkProductInventory(product));
    });
    async.series(checkInventoryArray, function finalizer(err, results) {
        if (err) {
            msg = "Error with checkInventoryArray: " + JSON.stringify(err);
            console.error(msg);
            return callback(null, createResponse(404, {"message": msg}))
        }
        msg = "Successfully ran checkInventoryArray"
        console.log(msg);
        if (body.products.length > MAX_PRODUCTS_PER_ORDER) {
            var updateInventoryArray = [];
            body.products.forEach(function(product) {
                updateInventoryArray.push(updateProductInventory(product));
            });
            async.series(updateInventoryArray, function finalizer(err, results) {
                if (err) {
                    msg = "Error with updateInventoryArray: " + JSON.stringify(err);
                    console.error(msg);
                    return callback(null, createResponse(404, {"message": msg}))
                }
                msg = "Successfully ran updateInventoryArray"
                console.log(msg);
                var newOrderParams = buildNewOrderObject(event.requestContext.requestId, body);
                console.dir(newOrderParams);
                ddb.putItem(newOrderParams, function(err, data) {
                    if (err) {
                        msg = "Error with putItem: " + JSON.stringify(err);
                        console.error(msg);
                        return callback(null, createResponse(404, {"message": msg}))
                    }
                    return callback(null, createResponse(200, {'id' : event.requestContext.requestId }));
                });
            });
        } else {
            var transactionArray = [];
            transactionArray.push({
                'Put' : buildNewOrderObject(event.requestContext.requestId, body)
            });
            body.products.forEach(function(product) {
                var updateProductObject = buildUpdateProductObject(product);
                updateProductObject['ConditionExpression'] = '(inventory > :orderCount) and (:orderCount > 0)';
                updateProductObject['ExpressionAttributeValues'][':orderCount'] = { "N": product.count.toString() };
                transactionArray.push({
                    'Update' : buildUpdateProductObject(product)
                });
            });
            var params = { 'TransactItems' : transactionArray };
            console.dir(params);
            ddb.transactWriteItems(params, function(err, data) {
                if (err) {
                    msg = "Error with transactWriteItems: " + JSON.stringify(err);
                    console.error(msg);
                    return callback(null, createResponse(404, {"message": msg}))
                }
                return callback(null, createResponse(200, {'id' : event.requestContext.requestId }));
            });
        }
    });
}
