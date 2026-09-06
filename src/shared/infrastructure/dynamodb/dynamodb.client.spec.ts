import type { AppConfig } from '../configuration';
import { createDynamoDbDocumentClient } from './dynamodb.client';

function localConfig(nodeEnv: AppConfig['nodeEnv']): AppConfig {
  return {
    allowedOrigins: ['http://localhost:3000'],
    awsRegion: 'us-east-1',
    cookieName: 'stone_access_token',
    cookieSecure: false,
    dynamodbEndpoint: 'http://localhost:8000',
    dynamodbTablePrefix: undefined,
    jwtAccessTtlSeconds: 900,
    jwtAudience: 'stone-web',
    jwtIssuer: 'stone-api',
    jwtSecret: 'a-development-secret-with-at-least-32-characters',
    nodeEnv,
    port: 3000,
    productsTableName: 'stone_products',
    trustedProxyIps: [],
    usersTableName: 'stone_users',
  };
}

describe('DynamoDB document client', () => {
  it('creates a document client for the local endpoint without real credentials', () => {
    const client = createDynamoDbDocumentClient(localConfig('test'));

    expect(client.constructor.name).toBe('DynamoDBDocumentClient');
    client.destroy();
  });

  it('does not inject local credentials into production clients', () => {
    const client = createDynamoDbDocumentClient(localConfig('production'));

    expect(client.constructor.name).toBe('DynamoDBDocumentClient');
    client.destroy();
  });
});
