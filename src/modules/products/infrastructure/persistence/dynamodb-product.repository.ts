import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { Product } from '../../domain/product';
import { ProductIdAlreadyExistsError } from '../../application/errors/product-id-already-exists.error';
import type { ProductRepository } from '../../application/ports/product-repository';
import type { DocumentClient } from '../../../../shared/infrastructure/dynamodb/dynamodb.tokens';

interface ProductItem {
  readonly [key: string]: unknown;
  readonly createdAt: string;
  readonly description: string;
  readonly id: string;
  readonly imageUrl: string;
  readonly name: string;
  readonly price: number;
  readonly updatedAt: string;
}

const PRODUCT_ITEM_KEYS = [
  'createdAt',
  'description',
  'id',
  'imageUrl',
  'name',
  'price',
  'updatedAt',
] as const;

function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConditionalCheckFailedException';
}

function toProductItem(product: Product): ProductItem {
  return {
    createdAt: product.createdAt.toISOString(),
    description: product.description,
    id: product.id,
    imageUrl: product.imageUrl,
    name: product.name,
    price: product.price,
    updatedAt: product.updatedAt.toISOString(),
  };
}

function hasExactProductKeys(item: Record<string, unknown>): boolean {
  const keys = Object.keys(item).sort();
  return keys.length === PRODUCT_ITEM_KEYS.length &&
    keys.every((key, index) => key === PRODUCT_ITEM_KEYS[index]);
}

function isProductItem(item: Record<string, unknown>): item is ProductItem {
  return (
    hasExactProductKeys(item) &&
    typeof item.createdAt === 'string' &&
    typeof item.description === 'string' &&
    typeof item.id === 'string' &&
    typeof item.imageUrl === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    typeof item.updatedAt === 'string'
  );
}

function toProduct(item: Record<string, unknown>): Product {
  if (!isProductItem(item)) {
    throw new Error('O registro de produto persistido possui formato inválido.');
  }

  return Product.create({
    createdAt: new Date(item.createdAt),
    description: item.description,
    id: item.id,
    imageUrl: item.imageUrl,
    name: item.name,
    price: item.price,
    updatedAt: new Date(item.updatedAt),
  });
}

export class DynamoDbProductRepository implements ProductRepository {
  constructor(
    private readonly client: DocumentClient,
    private readonly tableName: string,
  ) {}

  async findById(id: string): Promise<Product | null> {
    const output = await this.client.send(
      new GetCommand({
        ConsistentRead: true,
        Key: { id },
        TableName: this.tableName,
      }),
    );

    if (output.Item === undefined) {
      return null;
    }

    return toProduct(output.Item as unknown as Record<string, unknown>);
  }

  async save(product: Product): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          ConditionExpression: 'attribute_not_exists(id)',
          Item: toProductItem(product),
          TableName: this.tableName,
        }),
      );
    } catch (error: unknown) {
      if (isConditionalCheckFailed(error)) {
        throw new ProductIdAlreadyExistsError();
      }

      throw error;
    }
  }
}
