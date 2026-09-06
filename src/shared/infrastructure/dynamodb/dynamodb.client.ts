import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { AppConfig } from '../configuration';

function isLocalEnvironment(config: AppConfig): boolean {
  return config.nodeEnv !== 'production';
}

export function createDynamoDbDocumentClient(
  config: AppConfig,
): DynamoDBDocumentClient {
  const clientConfig: DynamoDBClientConfig = {
    endpoint: config.dynamodbEndpoint,
    region: config.awsRegion,
  };

  if (isLocalEnvironment(config)) {
    clientConfig.credentials = {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    };
  }

  return DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig), {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}
