import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { Product } from '../../src/modules/products/domain/product';
import { ProductIdAlreadyExistsError } from '../../src/modules/products/application/errors/product-id-already-exists.error';
import { DynamoDbProductRepository } from '../../src/modules/products/infrastructure/persistence/dynamodb-product.repository';
import { DynamoDbCursorCodec } from '../../src/modules/products/infrastructure/persistence/dynamodb-cursor-codec';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const region = process.env.AWS_REGION ?? 'us-east-1';
const tableName = `integration_${process.pid}_products_repository`;
const client = new DynamoDBClient({
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpoint,
  region,
});
const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    endpoint,
    region,
  }),
);
const repository = new DynamoDbProductRepository(
  documentClient,
  tableName,
  new DynamoDbCursorCodec(),
);

async function deleteTableIfPresent(): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return;
    }

    throw error;
  }

  await client.send(new DeleteTableCommand({ TableName: tableName }));
}

async function createTable(): Promise<void> {
  await client.send(
    new CreateTableCommand({
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      TableName: tableName,
    }),
  );
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: tableName });
}

function createProduct(id: string, price = 99.9): Product {
  return Product.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    description: 'Descrição do produto',
    id,
    imageUrl: 'https://example.com/product.png',
    name: 'Produto',
    price,
    updatedAt: new Date('2026-09-04T12:00:00.000Z'),
  });
}

describe('DynamoDB product repository', () => {
  beforeAll(async () => {
    await deleteTableIfPresent();
    await createTable();
  });

  afterAll(async () => {
    await deleteTableIfPresent();
    client.destroy();
    documentClient.destroy();
  });

  it('persists and reads exactly the approved product attributes', async () => {
    const product = createProduct('product-integration-123');
    await repository.save(product);

    const persisted = await repository.findById(product.id);

    expect(persisted?.toPublicData()).toEqual(product.toPublicData());
  });

  it('returns null for an absent product', async () => {
    await expect(repository.findById('product-not-found')).resolves.toBeNull();
  });

  it('does not replace an existing product when the ID collides', async () => {
    await repository.save(createProduct('product-collision', 10));

    await expect(repository.save(createProduct('product-collision', 20))).rejects.toBeInstanceOf(
      ProductIdAlreadyExistsError,
    );
    await expect(repository.findById('product-collision')).resolves.toMatchObject({
      price: 10,
    });
  });

  it('lists a stable set sequentially by DynamoDB cursor', async () => {
    const products = ['product-page-1', 'product-page-2', 'product-page-3'];

    for (const id of products) {
      await repository.save(createProduct(id));
    }

    const listedIds: string[] = [];
    let cursor: string | undefined;

    do {
      const page = await repository.list(1, cursor);
      listedIds.push(...page.items.map((product) => product.id));
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    expect(new Set(listedIds).size).toBe(listedIds.length);
    expect(listedIds).toEqual(expect.arrayContaining(products));
  });
});
