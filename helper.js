'use strict';
const AWS = require('aws-sdk');
let dynamo = new AWS.DynamoDB.DocumentClient();
const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
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
module.exports.revokePermissions = async (ip) => {
  console.log(ip)
  const id = await this.getSecurityGroupId();
  const sgParams = {
    GroupId: id,
    IpPermissions: [
      {
        FromPort: 22,
        IpProtocol: 'tcp',
        IpRanges: [
          {
            CidrIp: ip
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
