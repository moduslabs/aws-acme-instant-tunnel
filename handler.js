'use strict';
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const helper = require('./helper');

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_CLIENT_PUBLIC_KEY = process.env.AUTH0_CLIENT_PUBLIC_KEY;
const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
let dynamo = new AWS.DynamoDB.DocumentClient();

const generatePolicy = (principalId, effect, resource) => {
  const authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument = {};
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statementOne = {};
    statementOne.Action = 'execute-api:Invoke';
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};
module.exports.auth = (event, context, callback) => {
  console.log('event', event);
  if (!event.authorizationToken) {
    return callback('Unauthorized');
  }

  const tokenParts = event.authorizationToken.split(' ');
  const tokenValue = tokenParts[1];

  if (!(tokenParts[0].toLowerCase() === 'bearer' && tokenValue)) {
    // no auth token!
    return callback('Unauthorized');
  }
  const options = {
    audience: AUTH0_CLIENT_ID,
  };

  try {
    jwt.verify(
      tokenValue,
      AUTH0_CLIENT_PUBLIC_KEY,
      options,
      (verifyError, decoded) => {
        if (verifyError) {
          console.log('verifyError', verifyError);
          // 401 Unauthorized
          console.log(`Token invalid. ${verifyError}`);
          return callback('Unauthorized');
        }
        // is custom authorizer function
        console.log('valid from customAuthorizer', decoded);
        return callback(
          null,
          generatePolicy(decoded.sub, 'Allow', event.methodArn)
        );
      }
    );
  } catch (err) {
    console.log('catch error. Invalid token', err);
    return callback('Unauthorized');
  }
};
module.exports.addLease = (event, context, callback) => {
  callback(null, {
    statusCode: 200,
    headers: {
      /* Required for CORS support to work */
      'Access-Control-Allow-Origin': '*',
      /* Required for cookies, authorization headers with HTTPS */
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: 'You can now SSH into the EC2 instance for 1 hour',
    }),
  });
  let item = JSON.parse(JSON.stringify(event));
  item = JSON.parse(item.body);
  item.leaseId = uuidv4();
  console.log(item);
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
  addNewPermissions(item, context, callback);
};
module.exports.updateExpiredLeases = async (event, context, callback) => {
  const items = await helper.getExpiredLeases();
  console.log(items);
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
    headers: {
      /* Required for CORS support to work */
      'Access-Control-Allow-Origin': '*',
      /* Required for cookies, authorization headers with HTTPS */
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(message),
  };
}
async function addNewPermissions(item, context, callback) {
  const id = await helper.getSecurityGroupId();
  const sgParams = {
    GroupId: id,
    IpPermissions: [
      {
        FromPort: 22,
        IpProtocol: 'tcp',
        IpRanges: [
          {
            CidrIp: item.ip,
            Description: `Access for ${item.name}`,
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
