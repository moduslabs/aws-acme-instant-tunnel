'use strict';
const AWS = require('aws-sdk');
const { uuid } = require('uuidv4');
const helper = require('./helper');
const TABLE_NAME = process.env.DYNAMODB_TABLE;
const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
let dynamo = new AWS.DynamoDB.DocumentClient();
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
    })
    .catch(() => {
      callback(err, null);
    });
  addNewPermissions(event, context, callback);
};
module.exports.updateExpiredLeases = async (event, context, callback) => {
  const items = await helper.getExpiredLeases();
  // array of items that match params
  items.forEach((item) => {
    helper.revokePermissions(item);
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
  return items;
};
function createResponse(statusCode, message) {
  return {
    statusCode: statusCode,
    body: JSON.stringify(message),
  };
}
async function addNewPermissions(event, context, callback) {
  const id = await helper.getSecurityGroupId();
  const sgParams = {
    GroupId: id,
    IpPermissions: [
      {
        FromPort: 22,
        IpProtocol: 'tcp',
        IpRanges: [
          {
            CidrIp: event.ip,
            Description: `Access for ${event.name}`,
          },
        ],
        ToPort: 22,
      },
    ],
  };
  ec2
    .authorizeSecurityGroupIngress(sgParams)
    .promise()
    .then((result) => {
      callback(null, createResponse(200, result));
    });
}
