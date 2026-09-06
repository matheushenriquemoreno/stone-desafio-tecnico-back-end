import { InvalidProductDataError } from './errors/product-domain.error';
import { Product, type ProductProps } from './product';

const createdAt = new Date('2026-09-04T12:00:00.000Z');

function validProduct(overrides: Partial<ProductProps> = {}): ProductProps {
  return {
    createdAt,
    description: 'Descrição do produto',
    id: 'product-123',
    imageUrl: 'https://example.com/product.png',
    name: 'Produto',
    price: 99.9,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('product invariants', () => {
  it('creates and serializes a complete product with deterministic dates', () => {
    const product = Product.create(validProduct());

    expect(product.toPublicData()).toEqual({
      createdAt: '2026-09-04T12:00:00.000Z',
      description: 'Descrição do produto',
      id: 'product-123',
      imageUrl: 'https://example.com/product.png',
      name: 'Produto',
      price: 99.9,
      updatedAt: '2026-09-04T12:00:00.000Z',
    });
  });

  it.each([
    { field: 'name', value: 'A' },
    { field: 'name', value: 'A'.repeat(101) },
    { field: 'description', value: '' },
    { field: 'description', value: 'A'.repeat(501) },
    { field: 'imageUrl', value: '' },
    { field: 'imageUrl', value: 'A'.repeat(2_049) },
  ])('rejects an invalid $field boundary', ({ field, value }) => {
    expect(() => Product.create(validProduct({ [field]: value }))).toThrow(
      InvalidProductDataError,
    );
  });

  it('accepts inclusive string boundaries', () => {
    expect(() => Product.create(validProduct({ name: 'A'.repeat(2) }))).not.toThrow();
    expect(() => Product.create(validProduct({ name: 'A'.repeat(100) }))).not.toThrow();
    expect(() => Product.create(validProduct({ description: 'A' }))).not.toThrow();
    expect(() =>
      Product.create(validProduct({ description: 'A'.repeat(500) })),
    ).not.toThrow();
    expect(() =>
      Product.create(validProduct({ imageUrl: `https://example.com/${'a'.repeat(2_027)}` })),
    ).not.toThrow();
  });

  it.each([0, -1, 1.001, 0.001, 1.005, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects price %p when it is not positive with at most two decimals',
    (price) => {
      expect(() => Product.create(validProduct({ price }))).toThrow(
        InvalidProductDataError,
      );
    },
  );

  it.each([0.01, 1, 1.2, 1.23, 1e-2])(
    'accepts price %p with at most two decimal places',
    (price) => {
      expect(() => Product.create(validProduct({ price }))).not.toThrow();
    },
  );

  it.each(['ftp://example.com/image.png', 'javascript:alert(1)', 'not-a-url'])(
    'rejects image URL %s outside HTTP(S)',
    (imageUrl) => {
      expect(() => Product.create(validProduct({ imageUrl }))).toThrow(
        InvalidProductDataError,
      );
    },
  );

  it('keeps date values isolated from external mutation', () => {
    const product = Product.create(validProduct());
    const exposedCreatedAt = product.createdAt;
    const exposedUpdatedAt = product.updatedAt;

    exposedCreatedAt.setFullYear(2000);
    exposedUpdatedAt.setFullYear(2000);

    expect(product.createdAt.toISOString()).toBe('2026-09-04T12:00:00.000Z');
    expect(product.updatedAt.toISOString()).toBe('2026-09-04T12:00:00.000Z');
    expect(product.id).toBe('product-123');
  });
});
