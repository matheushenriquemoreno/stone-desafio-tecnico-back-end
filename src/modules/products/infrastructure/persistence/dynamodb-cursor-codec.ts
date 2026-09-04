import { InvalidProductCursorError } from '../../application/errors/invalid-product-cursor.error';

const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 2_048;

export interface DynamoDbCursorKey {
  readonly id: string;
}

export const PRODUCT_CURSOR_CODEC = Symbol('PRODUCT_CURSOR_CODEC');

export interface ProductCursorCodec {
  encode(key: Record<string, unknown>): string;
  decode(cursor: string): DynamoDbCursorKey;
}

interface CursorEnvelope {
  readonly key: DynamoDbCursorKey;
  readonly version: number;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
}

function isCursorKey(value: unknown): value is DynamoDbCursorKey {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasOnlyKeys(value as Record<string, unknown>, ['id']) &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (value as { id: string }).id.length > 0
  );
}

function isCursorEnvelope(value: unknown): value is CursorEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const envelope = value as { key?: unknown; version?: unknown };
  return (
    hasOnlyKeys(value as Record<string, unknown>, ['key', 'version']) &&
    envelope.version === CURSOR_VERSION &&
    isCursorKey(envelope.key)
  );
}

function invalidCursor(): never {
  throw new InvalidProductCursorError();
}

function decodeBase64Url(cursor: string): string {
  if (
    cursor.length === 0 ||
    cursor.length > MAX_CURSOR_LENGTH ||
    cursor.length % 4 === 1 ||
    !/^[A-Za-z0-9_-]+$/.test(cursor)
  ) {
    return invalidCursor();
  }

  const decoded = Buffer.from(cursor, 'base64url');

  if (decoded.toString('base64url') !== cursor) {
    return invalidCursor();
  }

  return decoded.toString('utf8');
}

export class DynamoDbCursorCodec implements ProductCursorCodec {
  encode(key: Record<string, unknown>): string {
    if (!isCursorKey(key)) {
      throw new Error('A chave de continuação do produto possui formato inválido.');
    }

    const envelope: CursorEnvelope = {
      key,
      version: CURSOR_VERSION,
    };
    return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  }

  decode(cursor: string): DynamoDbCursorKey {
    if (typeof cursor !== 'string') {
      return invalidCursor();
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(decodeBase64Url(cursor)) as unknown;
    } catch {
      return invalidCursor();
    }

    if (!isCursorEnvelope(parsed)) {
      return invalidCursor();
    }

    return { id: parsed.key.id };
  }
}
