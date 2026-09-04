import { InvalidProductCursorError } from '../../application/errors/invalid-product-cursor.error';
import {
  DynamoDbCursorCodec,
  type DynamoDbCursorKey,
} from './dynamodb-cursor-codec';

describe('DynamoDbCursorCodec', () => {
  const codec = new DynamoDbCursorCodec();

  it('encodes and decodes only the approved product key', () => {
    const cursor = codec.encode({ id: 'product-123' });

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codec.decode(cursor)).toEqual<DynamoDbCursorKey>({ id: 'product-123' });
  });

  it.each([
    'not-base64',
    'a',
    Buffer.from('{"version":2,"key":{"id":"product-123"}}', 'utf8').toString(
      'base64url',
    ),
    Buffer.from('{"version":1,"key":{"id":123}}', 'utf8').toString('base64url'),
    Buffer.from('{"version":1,"key":{"id":"product-123","extra":"x"}}', 'utf8').toString(
      'base64url',
    ),
    Buffer.from('{"version":1,"key":{"id":"product-123"},"extra":"x"}', 'utf8').toString(
      'base64url',
    ),
    `${'a'.repeat(2_049)}`,
  ])('rejects an invalid cursor with a safe validation error', (cursor) => {
    expect(() => codec.decode(cursor)).toThrow(InvalidProductCursorError);
    expect(() => codec.decode(cursor)).toThrow('cursor informado é inválido');
    expect(() => codec.decode(cursor)).not.toThrow('product-123');
  });

  it('rejects malformed JSON without exposing its payload', () => {
    const cursor = Buffer.from('{"version":1,', 'utf8').toString('base64url');

    expect(() => codec.decode(cursor)).toThrow(InvalidProductCursorError);
    expect(() => codec.decode(cursor)).not.toThrow('{"version":1,');
  });

  it('rejects an internal continuation key with unapproved attributes', () => {
    expect(() => codec.encode({ id: 'product-123', ownerId: 'private' })).toThrow(
      'formato inválido',
    );
  });
});
