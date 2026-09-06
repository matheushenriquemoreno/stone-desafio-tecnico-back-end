import { Product } from '../../domain/product';
import type { Product as ProductEntity } from '../../domain/product';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import type { ProductPage, ProductRepository } from '../ports/product-repository';
import { GetProduct } from './get-product';

class RecordingProductRepository implements ProductRepository {
  product: ProductEntity | null = null;
  requestedId: string | undefined;
  error: Error | undefined;

  async findById(id: string): Promise<ProductEntity | null> {
    this.requestedId = id;
    if (this.error !== undefined) {
      throw this.error;
    }

    return this.product;
  }

  async list(): Promise<ProductPage> {
    return { items: [], total: 0 };
  }

  async save(): Promise<void> {
    return Promise.resolve();
  }
}

function createProduct(): ProductEntity {
  return Product.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    description: 'Descrição do produto',
    id: 'product-123',
    imageUrl: 'https://example.com/product.png',
    name: 'Produto',
    price: 99.9,
    updatedAt: new Date('2026-09-04T12:00:00.000Z'),
  });
}

describe('GetProduct', () => {
  it('returns the requested product without applying an owner filter', async () => {
    const repository = new RecordingProductRepository();
    repository.product = createProduct();
    const useCase = new GetProduct(repository);

    await expect(useCase.execute('product-123')).resolves.toBe(repository.product);
    expect(repository.requestedId).toBe('product-123');
  });

  it('maps absence to PRODUCT_NOT_FOUND', async () => {
    const repository = new RecordingProductRepository();
    const useCase = new GetProduct(repository);

    await expect(useCase.execute('missing-product')).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  it('propagates persistence failures', async () => {
    const repository = new RecordingProductRepository();
    repository.error = new Error('DynamoDB unavailable');
    const useCase = new GetProduct(repository);

    await expect(useCase.execute('product-123')).rejects.toBe(repository.error);
  });
});
