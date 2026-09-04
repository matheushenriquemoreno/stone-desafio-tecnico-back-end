import { Product } from '../../domain/product';
import { ProductIdAlreadyExistsError } from '../../application/errors/product-id-already-exists.error';
import type { DocumentClient } from '../../../../shared/infrastructure/dynamodb/dynamodb.tokens';
import { DynamoDbProductRepository } from './dynamodb-product.repository';
import { DynamoDbCursorCodec } from './dynamodb-cursor-codec';

interface SentCommand {
  readonly input: unknown;
}

function createFakeClient(handler: (command: SentCommand) => Promise<unknown>): {
  client: DocumentClient;
  commands: SentCommand[];
} {
  const commands: SentCommand[] = [];
  const client = {
    send: async (command: SentCommand): Promise<unknown> => {
      commands.push(command);
      return handler(command);
    },
  } as unknown as DocumentClient;

  return { client, commands };
}

function createProduct(id = 'product-123'): Product {
  return Product.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    description: 'Descrição do produto',
    id,
    imageUrl: 'https://example.com/product.png',
    name: 'Produto',
    price: 99.9,
    updatedAt: new Date('2026-09-04T12:00:00.000Z'),
  });
}

const cursorCodec = new DynamoDbCursorCodec();

describe('DynamoDbProductRepository', () => {
  it('writes exactly the approved product attributes with atomic creation', async () => {
    const fake = createFakeClient(async () => ({}));
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    await repository.save(createProduct());

    expect(fake.commands[0]?.input).toEqual({
      ConditionExpression: 'attribute_not_exists(id)',
      Item: {
        createdAt: '2026-09-04T12:00:00.000Z',
        description: 'Descrição do produto',
        id: 'product-123',
        imageUrl: 'https://example.com/product.png',
        name: 'Produto',
        price: 99.9,
        updatedAt: '2026-09-04T12:00:00.000Z',
      },
      TableName: 'products',
    });
  });

  it('maps a conditional conflict without overwriting the existing item', async () => {
    const conditionalFailure = Object.assign(new Error('condition failed'), {
      name: 'ConditionalCheckFailedException',
    });
    const fake = createFakeClient(async () => {
      throw conditionalFailure;
    });
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    await expect(repository.save(createProduct())).rejects.toBeInstanceOf(
      ProductIdAlreadyExistsError,
    );
  });

  it('rethrows technical failures instead of treating them as collisions', async () => {
    const technicalFailure = new Error('DynamoDB unavailable');
    const fake = createFakeClient(async () => {
      throw technicalFailure;
    });
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    await expect(repository.save(createProduct())).rejects.toBe(technicalFailure);
  });

  it('maps an existing item and returns null when the product is absent', async () => {
    let callCount = 0;
    const fake = createFakeClient(async () => {
      callCount += 1;

      if (callCount === 1) {
        return {
          Item: {
            createdAt: '2026-09-04T12:00:00.000Z',
            description: 'Descrição do produto',
            id: 'product-123',
            imageUrl: 'https://example.com/product.png',
            name: 'Produto',
            price: 99.9,
            updatedAt: '2026-09-04T12:00:00.000Z',
          },
        };
      }

      return {};
    });
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    await expect(repository.findById('product-123')).resolves.toMatchObject({
      id: 'product-123',
      name: 'Produto',
      price: 99.9,
    });
    await expect(repository.findById('missing-product')).resolves.toBeNull();

    expect(fake.commands[0]?.input).toEqual({
      ConsistentRead: true,
      Key: { id: 'product-123' },
      TableName: 'products',
    });
    expect(fake.commands[1]?.input).toEqual({
      ConsistentRead: true,
      Key: { id: 'missing-product' },
      TableName: 'products',
    });
  });

  it('rejects persisted items with an unapproved attribute', async () => {
    const fake = createFakeClient(async () => ({
      Item: {
        createdAt: '2026-09-04T12:00:00.000Z',
        description: 'Descrição do produto',
        id: 'product-123',
        imageUrl: 'https://example.com/product.png',
        name: 'Produto',
        price: 99.9,
        updatedAt: '2026-09-04T12:00:00.000Z',
        ownerId: 'unexpected',
      },
    }));
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    await expect(repository.findById('product-123')).rejects.toThrow(
      'formato inválido',
    );
  });

  it('scans with the requested limit and translates continuation keys', async () => {
    let callCount = 0;
    const fake = createFakeClient(async () => {
      callCount += 1;

      if (callCount === 1) {
        return {
          Items: [
            {
              createdAt: '2026-09-04T12:00:00.000Z',
              description: 'Descrição do produto',
              id: 'product-123',
              imageUrl: 'https://example.com/product.png',
              name: 'Produto',
              price: 99.9,
              updatedAt: '2026-09-04T12:00:00.000Z',
            },
          ],
          LastEvaluatedKey: { id: 'product-123' },
        };
      }

      return { Items: [] };
    });
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    const firstPage = await repository.list(1);
    const secondPage = await repository.list(1, firstPage.nextCursor);

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).toBe(cursorCodec.encode({ id: 'product-123' }));
    expect(secondPage).toEqual({ items: [] });
    expect(fake.commands[0]?.input).toEqual({ Limit: 1, TableName: 'products' });
    expect(fake.commands[1]?.input).toEqual({
      ExclusiveStartKey: { id: 'product-123' },
      Limit: 1,
      TableName: 'products',
    });
  });

  it('updates only changed fields with an existence condition and returns the item', async () => {
    const fake = createFakeClient(async () => ({
      Attributes: {
        createdAt: '2026-09-04T12:00:00.000Z',
        description: 'Descrição nova',
        id: 'product-123',
        imageUrl: 'https://example.com/product.png',
        name: 'Produto',
        price: 109.9,
        updatedAt: '2026-09-04T13:00:00.000Z',
      },
    }));
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    const updatedProduct = await repository.update(createProduct(), ['description', 'price']);

    expect(updatedProduct?.toPublicData()).toEqual({
      createdAt: '2026-09-04T12:00:00.000Z',
      description: 'Descrição nova',
      id: 'product-123',
      imageUrl: 'https://example.com/product.png',
      name: 'Produto',
      price: 109.9,
      updatedAt: '2026-09-04T13:00:00.000Z',
    });
    expect(fake.commands[0]?.input).toEqual({
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeNames: {
        '#description': 'description',
        '#price': 'price',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':description': 'Descrição do produto',
        ':price': 99.9,
        ':updatedAt': '2026-09-04T12:00:00.000Z',
      },
      Key: { id: 'product-123' },
      ReturnValues: 'ALL_NEW',
      TableName: 'products',
      UpdateExpression: 'SET #price = :price, #description = :description, #updatedAt = :updatedAt',
    });
  });

  it('maps a conditional update failure to absence', async () => {
    const conditionalFailure = Object.assign(new Error('condition failed'), {
      name: 'ConditionalCheckFailedException',
    });
    const fake = createFakeClient(async () => {
      throw conditionalFailure;
    });
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    await expect(repository.update(createProduct(), ['price'])).resolves.toBeNull();
  });

  it('deletes conditionally and maps an absent item to false', async () => {
    let callCount = 0;
    const fake = createFakeClient(async () => {
      callCount += 1;

      if (callCount === 2) {
        const conditionalFailure = Object.assign(new Error('condition failed'), {
          name: 'ConditionalCheckFailedException',
        });
        throw conditionalFailure;
      }

      return {};
    });
    const repository = new DynamoDbProductRepository(fake.client, 'products', cursorCodec);

    await expect(repository.delete('product-123')).resolves.toBe(true);
    await expect(repository.delete('missing-product')).resolves.toBe(false);
    expect(fake.commands[0]?.input).toEqual({
      ConditionExpression: 'attribute_exists(id)',
      Key: { id: 'product-123' },
      TableName: 'products',
    });
  });
});
