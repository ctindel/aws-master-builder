var aws = require("aws-sdk");
const ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
const util = require('util')

const getTableNameFromARN = (arn) => {
  /** This is a default dynamo table arn
   *  arn:aws:dynamodb:eu-west-1:123456789012:table/table-name/stream/2015-11-13T09:23:17.104
   *  After split
   *  [
   *    'arn:aws:dynamodb:eu-west-1:123456789012:table',
   *    'table-name',
   *    'stream',
   *    '2015-11-13T09:23:17.104'
   *  ]
   */
    return arn.split('/')[1].toLowerCase();
}

function putProductItem(record, callback) {
    var newItem = record.dynamodb.NewImage;
    newItem['id'] = { 'S' : record.dynamodb.NewImage.oid__id.S };
    delete newItem.oid__id;
    var params = { TableName: process.env.TARGET_DDB_TABLE, Item : newItem};
    ddb.putItem(params, function(err, data) {
        return callback(err, data);
    });
}

function putReviewItem(record, callback) {
    var newItem = record.dynamodb.NewImage;
    newItem['id'] = { 'S' : record.dynamodb.NewImage.oid__id.S };
    newItem['productId'] = { 'S' : record.dynamodb.NewImage.oid_productId.S };
    delete newItem.oid__id;
    delete newItem.oid_productId;
    var params = { TableName: process.env.TARGET_DDB_TABLE, Item : newItem};
    ddb.putItem(params, function(err, data) {
        return callback(err, data);
    });
}

function putOrderItem(record, callback) {
    var newItem = record.dynamodb.NewImage;
    newItem['id'] = { 'S' : record.dynamodb.NewImage.oid__id.S };
    var newProductArray = [];
    var products = JSON.parse(record.dynamodb.NewImage.array_products.S);
    products.forEach(function(product) {
        newProductArray.push({'M' : {'productId': { 'S' : product['productId']['$oid']}, 'count' : {'N' : product['count'].toString()}}});
    });
    newItem['products'] = { 'L' : newProductArray };
    delete newItem.oid__id;
    delete newItem.array_products;
    var params = { TableName: process.env.TARGET_DDB_TABLE, Item : newItem};
    ddb.putItem(params, function(err, data) {
        return callback(err, data);
    });
}

function putItem(record, callback) {
    var tableName = getTableNameFromARN(record.eventSourceARN);

    if (tableName == 'product') {
        putProductItem(record, callback);
    } else if (tableName == 'review') {
        putReviewItem(record, callback);
    } else if (tableName == 'order') {
        putOrderItem(record, callback);
    } else {
        return callback("ERROR: unknown table name " + tableName, null);
    }
}

function copyMDBItem(event, context, callback) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    if (event.Records.length !== 1) {
        return callback("ERROR: This lambda function can only handle 1 event at a time", null);
    }

    var record = event.Records[0];
    if (record.eventName == 'REMOVE') {
        var key = record.dynamodb.OldImage.oid__id.S;
        var params = { TableName: process.env.TARGET_DDB_TABLE, Key : { 'id' : { 'S' : record.dynamodb.OldImage.oid__id.S } } };
        ddb.deleteItem(params, function(err, data) {
            if (err) {
                console.error("copyEvent failed on ddb.deleteItem with key: " + key); 
                return callback(err);
            }
            console.log("Successfully processed delete for key " + key + " on table " + process.env.TARGET_DDB_TABLE);
            return callback(null, "Successfully processed delete for key " + key + " on table " + process.env.TARGET_DDB_TABLE);
        });
    } else {
        var key = record.dynamodb.NewImage.oid__id.S;
        putItem(record, function(err, data) {
            if (err) {
                console.error("copyEvent failed on ddb.putItem with key: " + key);
                return callback(err);
            }
            console.log("Successfully processed update for key " + key + " on table " + process.env.TARGET_DDB_TABLE);
            return callback(null, "Successfully processed update for key " + key + " on table " + process.env.TARGET_DDB_TABLE);
        });
    }
}
 
exports.handler = copyMDBItem;
