import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { Product } from '../../domain/product';
import { ProductIdAlreadyExistsError } from '../../application/errors/product-id-already-exists.error';
import type {
  ProductPage,
  ProductUpdateRepository,
} from '../../application/ports/product-repository';
import type { ProductEditableField } from '../../domain/product';
import type { DocumentClient } from '../../../../shared/infrastructure/dynamodb/dynamodb.tokens';
import type { ProductCursorCodec } from './dynamodb-cursor-codec';

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

const PRODUCT_EDITABLE_FIELDS: readonly ProductEditableField[] = [
  'name',
  'description',
  'price',
  'imageUrl',
];

function isProductEditableField(value: string): value is ProductEditableField {
  return PRODUCT_EDITABLE_FIELDS.includes(value as ProductEditableField);
}

export class DynamoDbProductRepository implements ProductUpdateRepository {
  constructor(
    private readonly client: DocumentClient,
    private readonly tableName: string,
    private readonly cursorCodec: ProductCursorCodec,
  ) {}

  async list(limit: number, cursor?: string): Promise<ProductPage> {
    const input: {
      readonly ExclusiveStartKey?: Record<string, unknown>;
      readonly Limit: number;
      readonly TableName: string;
    } = {
      Limit: limit,
      TableName: this.tableName,
      ...(cursor === undefined
        ? {}
        : {
            ExclusiveStartKey: this.cursorCodec.decode(cursor) as unknown as Record<
              string,
              unknown
            >,
          }),
    };
    const output = await this.client.send(new ScanCommand(input));
    const items = (output.Items ?? []).map((item) =>
      toProduct(item as unknown as Record<string, unknown>),
    );

    if (output.LastEvaluatedKey === undefined) {
      return { items };
    }

    return {
      items,
      nextCursor: this.cursorCodec.encode(
        output.LastEvaluatedKey as unknown as Record<string, unknown>,
      ),
    };
  }

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

  async update(
    product: Product,
    changedFields: readonly ProductEditableField[],
  ): Promise<Product | null> {
    if (
      changedFields.length === 0 ||
      changedFields.some((field) => !isProductEditableField(field))
    ) {
      throw new Error('A atualização do produto possui campos inválidos.');
    }

    const expressionAttributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': product.updatedAt.toISOString(),
    };
    const assignments = ['#updatedAt = :updatedAt'];

    for (const field of changedFields) {
      const nameToken = `#${field}`;
      const valueToken = `:${field}`;
      expressionAttributeNames[nameToken] = field;
      expressionAttributeValues[valueToken] = product[field];
      assignments.unshift(`${nameToken} = ${valueToken}`);
    }

    try {
      const output = await this.client.send(
        new UpdateCommand({
          ConditionExpression: 'attribute_exists(id)',
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          Key: { id: product.id },
          ReturnValues: 'ALL_NEW',
          TableName: this.tableName,
          UpdateExpression: `SET ${assignments.join(', ')}`,
        }),
      );

      if (output.Attributes === undefined) {
        throw new Error('A atualização do produto não retornou o registro atualizado.');
      }

      return toProduct(output.Attributes as unknown as Record<string, unknown>);
    } catch (error: unknown) {
      if (isConditionalCheckFailed(error)) {
        return null;
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteCommand({
          ConditionExpression: 'attribute_exists(id)',
          Key: { id },
          TableName: this.tableName,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (isConditionalCheckFailed(error)) {
        return false;
      }

      throw error;
    }
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
