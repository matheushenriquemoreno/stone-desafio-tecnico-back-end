import { createAppConfig, validateEnvironment } from './configuration';

function validEnvironment(): Record<string, unknown> {
  return {
    ALLOWED_ORIGINS: 'http://localhost:3000',
    AWS_REGION: 'us-east-1',
    COOKIE_NAME: 'stone_access_token',
    COOKIE_SECURE: 'false',
    DYNAMODB_ENDPOINT: 'http://localhost:8000',
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_AUDIENCE: 'stone-web',
    JWT_ISSUER: 'stone-api',
    JWT_SECRET: 'a-development-secret-with-at-least-32-characters',
    NODE_ENV: 'test',
    PORT: '3000',
    PRODUCTS_TABLE_NAME: 'stone_products_test',
    USERS_TABLE_NAME: 'stone_users_test',
  };
}

describe('environment configuration', () => {
  it('parses a complete valid environment into typed application settings', () => {
    const config = createAppConfig(validEnvironment());

    expect(config).toEqual({
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
      nodeEnv: 'test',
      port: 3000,
      productsTableName: 'stone_products_test',
      trustedProxyIps: [],
      usersTableName: 'stone_users_test',
    });
  });

  it('rejects a short JWT secret without including its value in the error', () => {
    const environment = validEnvironment();
    environment.JWT_SECRET = 'short';

    expect(() => validateEnvironment(environment)).toThrow('JWT_SECRET');
    expect(() => validateEnvironment(environment)).not.toThrow('short');
  });

  it('rejects a missing required setting by naming only the invalid field', () => {
    const environment = validEnvironment();
    delete environment.DYNAMODB_ENDPOINT;

    expect(() => validateEnvironment(environment)).toThrow('DYNAMODB_ENDPOINT');
  });

  it('applies the optional table prefix consistently to application settings', () => {
    const environment = validEnvironment();
    environment.DYNAMODB_TABLE_PREFIX = 'integration_123';

    expect(createAppConfig(environment)).toMatchObject({
      dynamodbTablePrefix: 'integration_123',
      productsTableName: 'integration_123_stone_products_test',
      usersTableName: 'integration_123_stone_users_test',
    });
  });

  it('requires the published cookie policy when running in production', () => {
    const environment = validEnvironment();
    environment.NODE_ENV = 'production';
    environment.COOKIE_NAME = 'stone_access_token';
    environment.COOKIE_SECURE = 'false';

    expect(() => validateEnvironment(environment)).toThrow('COOKIE_NAME');
    expect(() => validateEnvironment(environment)).toThrow('COOKIE_SECURE');
  });

  it('requires the published token lifetime when running in production', () => {
    const environment = validEnvironment();
    environment.NODE_ENV = 'production';
    environment.JWT_ACCESS_TTL_SECONDS = '899';
    environment.COOKIE_NAME = '__Host-stone_access_token';
    environment.COOKIE_SECURE = 'true';

    expect(() => validateEnvironment(environment)).toThrow('JWT_ACCESS_TTL_SECONDS');
  });

  it('parses explicit trusted proxy IPs', () => {
    const environment = validEnvironment();
    environment.TRUSTED_PROXY_IPS = '127.0.0.1, ::1';

    expect(createAppConfig(environment).trustedProxyIps).toEqual(['127.0.0.1', '::1']);
  });

  it('rejects an invalid trusted proxy IP without exposing its value', () => {
    const environment = validEnvironment();
    environment.TRUSTED_PROXY_IPS = 'not-an-ip';

    expect(() => validateEnvironment(environment)).toThrow('TRUSTED_PROXY_IPS');
    expect(() => validateEnvironment(environment)).not.toThrow('not-an-ip');
  });
});
