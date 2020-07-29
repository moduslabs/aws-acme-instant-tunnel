'use strict';
const AWS = require('aws-sdk');
let dynamo = new AWS.DynamoDB.DocumentClient();
const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
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
module.exports.getSecurityGroupId = () => {
  var params = {
    DryRun: false,
  };
  // Call EC2 to retrieve policy for selected bucket
  return ec2
    .describeInstances(params)
    .promise()
    .then((result) => {
      return result.Reservations[0].Instances[0].SecurityGroups[0].GroupId;
    });
};
