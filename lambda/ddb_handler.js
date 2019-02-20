var aws = require("aws-sdk");
const ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});

function copyEvent(event, context, callback) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    event.Records.forEach(function(record) {
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
            var newItem = record.dynamodb.NewImage;
            newItem['id'] = { 'S' : record.dynamodb.NewImage.oid__id.S };
            delete newItem.oid__id;
            var params = { TableName: process.env.TARGET_DDB_TABLE, Item : newItem};
            ddb.putItem(params, function(err, data) {
                if (err) {
                    console.error("copyEvent failed on ddb.putItem with key: " + newItem.id); 
                    return callback(err);
                }
                console.log("Successfully processed update for key " + newItem.id.S + " on table " + process.env.TARGET_DDB_TABLE);
                return callback(null, "Successfully processed update for key " + newItem.id.S + " on table " + process.env.TARGET_DDB_TABLE);
            });
        }
    });
}
 
exports.handler = copyEvent;
