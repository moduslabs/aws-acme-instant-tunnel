'use strict';
const AWS = require('aws-sdk');
let dynamo = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const currentTime = Date.now();
module.exports.getExpiredLeases = () => {
  var params = {
    TableName: TABLE_NAME,
    ProjectionExpression: '#date, leaseId',
    FilterExpression: '#date < :now',
    ExpressionAttributeNames: {
      '#date': 'leaseEnd',
    },
    ExpressionAttributeValues: {
      ':now': currentTime,
    },
  };
  return dynamo
    .scan(params)
    .promise()
    .then((result) => {
      return result.Items;
    });
};
