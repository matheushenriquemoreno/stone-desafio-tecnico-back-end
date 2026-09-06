import 'dotenv/config';

import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

import { resolveTableName } from '../src/shared/infrastructure/dynamodb/table-names';

interface TableDefinition {
  readonly name: string;
  readonly partitionKey: string;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Variável obrigatória ausente: ${name}.`);
  }

  return value;
}

function optionalPrefix(): string | undefined {
  const prefix = process.env.DYNAMODB_TABLE_PREFIX?.trim();

  if (prefix === undefined || prefix.length === 0) {
    return undefined;
  }

  if (!/^[A-Za-z0-9_.-]{1,50}$/.test(prefix)) {
    throw new Error('DYNAMODB_TABLE_PREFIX possui formato inválido.');
  }

  return prefix;
}

function tableDefinitions(): readonly TableDefinition[] {
  const prefix = optionalPrefix();
  const usersTableName = resolveTableName(
    requiredEnvironment('USERS_TABLE_NAME'),
    prefix,
  );
  const productsTableName = resolveTableName(
    requiredEnvironment('PRODUCTS_TABLE_NAME'),
    prefix,
  );

  if (usersTableName === productsTableName) {
    throw new Error('USERS_TABLE_NAME e PRODUCTS_TABLE_NAME devem ser diferentes.');
  }

  return [
    { name: usersTableName, partitionKey: 'email' },
    { name: productsTableName, partitionKey: 'id' },
  ];
}

function isResourceInUse(error: unknown): boolean {
  return (
    error instanceof ResourceInUseException ||
    (error instanceof Error && error.name === 'ResourceInUseException')
  );
}

async function verifyTable(
  client: DynamoDBClient,
  definition: TableDefinition,
): Promise<void> {
  await waitUntilTableExists(
    { client, maxWaitTime: 30 },
    { TableName: definition.name },
  );
  const result = await client.send(
    new DescribeTableCommand({ TableName: definition.name }),
  );
  const table = result.Table;
  const keySchema = table?.KeySchema ?? [];
  const attributeDefinitions = table?.AttributeDefinitions ?? [];
  const hasExpectedKey =
    keySchema.length === 1 &&
    keySchema[0]?.AttributeName === definition.partitionKey &&
    keySchema[0]?.KeyType === 'HASH';
  const hasExpectedAttribute =
    attributeDefinitions.length === 1 &&
    attributeDefinitions[0]?.AttributeName === definition.partitionKey &&
    attributeDefinitions[0]?.AttributeType === 'S';
  const hasExpectedBillingMode =
    table?.BillingModeSummary?.BillingMode === 'PAY_PER_REQUEST';

  if (
    table?.TableStatus !== 'ACTIVE' ||
    !hasExpectedKey ||
    !hasExpectedAttribute ||
    !hasExpectedBillingMode
  ) {
    throw new Error(`Tabela ${definition.name} possui configuração incompatível.`);
  }
}

async function provisionTable(
  client: DynamoDBClient,
  definition: TableDefinition,
): Promise<void> {
  try {
    await client.send(
      new CreateTableCommand({
        AttributeDefinitions: [
          { AttributeName: definition.partitionKey, AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [{ AttributeName: definition.partitionKey, KeyType: 'HASH' }],
        TableName: definition.name,
      }),
    );
  } catch (error: unknown) {
    if (!isResourceInUse(error)) {
      throw error;
    }
  }

  await verifyTable(client, definition);
  process.stdout.write(`Tabela pronta: ${definition.name}\n`);
}

async function provision(): Promise<void> {
  const endpoint = requiredEnvironment('DYNAMODB_ENDPOINT');
  const region = requiredEnvironment('AWS_REGION');
  const client = new DynamoDBClient({
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    endpoint,
    region,
  });

  try {
    for (const definition of tableDefinitions()) {
      await provisionTable(client, definition);
    }
  } finally {
    client.destroy();
  }
}

provision().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Falha ao provisionar tabelas.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
