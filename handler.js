'use strict';
const AWS = require('aws-sdk');
const { uuid } = require('uuidv4');
const helper = require('./helper');
const TABLE_NAME = process.env.DYNAMODB_TABLE;
let dynamo = new AWS.DynamoDB.DocumentClient();
function createResponse(statusCode, message) {
  return {
    statusCode: statusCode,
    body: JSON.stringify(message),
  };
}
module.exports.addLease = (event, context, callback) => {
  const item = JSON.parse(JSON.stringify(event));
  console.log(item);
  item.leaseId = uuid();
  const params = {
    TableName: TABLE_NAME,
    Item: item,
  };
  dynamo
    .put(params)
    .promise()
    .then(() => {
      callback(null, createResponse(200, item.leaseId));
    });
};
module.exports.updateExpiredLeases = async (event, context, callback) => {
  const items = await helper.getExpiredLeases();
  // array of items that match params
  items.forEach((item) => {
    var updatedParams = {
      TableName: TABLE_NAME,
      Key: {
        leaseId: item.leaseId,
        leaseEnd: item.leaseEnd,
      },
      UpdateExpression: 'set leaseActive = :la',
      ExpressionAttributeValues: {
        ':la': false,
      },
      ReturnValues: 'UPDATED_NEW',
    };
    dynamo
      .update(updatedParams)
      .promise()
      .then((err, response) => {
        if (err) {
          callback(err, null);
        } else {
          callback(null, createResponse(200, response));
        }
      });
  });
};
