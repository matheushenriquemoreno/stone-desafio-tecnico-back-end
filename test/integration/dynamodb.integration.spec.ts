import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

interface TestTable {
  readonly name: string;
  readonly partitionKey: string;
}

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const region = process.env.AWS_REGION ?? 'us-east-1';
const testPrefix = `integration_${process.pid}`;
const tables: readonly TestTable[] = [
  { name: `${testPrefix}_users`, partitionKey: 'email' },
  { name: `${testPrefix}_products`, partitionKey: 'id' },
];
const client = new DynamoDBClient({
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpoint,
  region,
});

async function createTestTable(table: TestTable): Promise<void> {
  await client.send(
    new CreateTableCommand({
      AttributeDefinitions: [{ AttributeName: table.partitionKey, AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: table.partitionKey, KeyType: 'HASH' }],
      TableName: table.name,
    }),
  );
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: table.name });
}

describe('DynamoDB Local isolation', () => {
  beforeAll(async () => {
    for (const table of tables) {
      await createTestTable(table);
    }
  });

  afterAll(async () => {
    for (const table of tables) {
      await client.send(new DeleteTableCommand({ TableName: table.name }));
    }
    client.destroy();
  });

  it('creates isolated users and products tables with only their approved keys', async () => {
    const descriptions = await Promise.all(
      tables.map((table) =>
        client.send(new DescribeTableCommand({ TableName: table.name })),
      ),
    );

    expect(descriptions).toHaveLength(2);
    for (const [index, description] of descriptions.entries()) {
      const table = description.Table;
      const expected = tables[index];

      expect(table?.TableName).toBe(expected?.name);
      expect(table?.TableStatus).toBe('ACTIVE');
      expect(table?.KeySchema).toEqual([
        { AttributeName: expected?.partitionKey, KeyType: 'HASH' },
      ]);
      expect(table?.AttributeDefinitions).toEqual([
        { AttributeName: expected?.partitionKey, AttributeType: 'S' },
      ]);
    }
  });
});
