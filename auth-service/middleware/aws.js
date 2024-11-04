const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
require('dotenv').config();
aws_region = process.env.AWS_REGION;

const secretsManagerClient = new SecretsManagerClient({ region: aws_region });

async function getSecret(secretName) {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsManagerClient.send(command);
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error(`Error retrieving secret: ${secretName}`, error);
    throw error;
  }
}

const ssmClient = new SSMClient({ region: aws_region });

async function getParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter.Value;
  } catch (error) {
    console.error(`Error retrieving parameter: ${name}`, error);
    throw error;
  }
}

module.exports = {
    getParameter,
    getSecret
  };