'use strict';
const AWS = require('aws-sdk');
let dynamo = new AWS.DynamoDB.DocumentClient();
const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
const TABLE_NAME = process.env.DYNAMODB_TABLE;
const currentTime = Date.now();
module.exports.getExpiredLeases = () => {
  var params = {
    TableName: TABLE_NAME,
    FilterExpression: '#date < :now AND #la = :la',
    ExpressionAttributeNames: {
      '#date': 'leaseEnd',
      '#la': 'leaseActive',
    },
    ExpressionAttributeValues: {
      ':now': currentTime,
      ':la': true,
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
module.exports.revokePermissions = async (item) => {
  const id = await this.getSecurityGroupId();
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
    .revokeSecurityGroupIngress(sgParams)
    .promise()
    .then((result) => {
      return result;
    });
};
