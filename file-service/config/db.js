const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");
const { S3Client } = require("@aws-sdk/client-s3");
const { DynamoDBClient, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
// Load environment variables
require('dotenv').config();

const credentialProvider = fromNodeProviderChain();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: credentialProvider
});

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: credentialProvider
});

const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

const connectDB = async () => {
  try {
    // Test the connection by listing DynamoDB tables
    await dynamoClient.send(new ListTablesCommand({}));
    console.log('Connected to DynamoDB');
  } catch (error) {
    console.error('Failed to connect to DynamoDB', error);
    process.exit(1);
  }
};

module.exports = { s3Client, dynamoDB, connectDB };