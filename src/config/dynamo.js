// src/config/dynamo.js
// Central place that builds the DynamoDB clients the rest of the app uses.
//
// Credentials are resolved automatically by the AWS SDK's default provider chain:
//   - On EC2 it uses the attached IAM instance role (no keys in code).
//   - On your laptop it uses `aws configure` / environment variables.
// This is why you never see an access key anywhere in this project.

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.RECIPES_TABLE || "Recipes";

// Low-level client (used by create-table script).
const client = new DynamoDBClient({ region: REGION });

// Document client marshals plain JS objects <-> DynamoDB types for us.
const ddbDoc = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

module.exports = { client, ddbDoc, REGION, TABLE_NAME };
