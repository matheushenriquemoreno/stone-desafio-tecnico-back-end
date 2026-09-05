import { ValidationApplicationError } from '../../../../shared/application/errors/application-error';
import type { Product } from '../../domain/product';
import type { ProductPage, ProductRepository } from '../ports/product-repository';
import { ListProducts } from './list-products';

class RecordingProductRepository implements ProductRepository {
  lastLimit: number | undefined;
  lastCursor: string | undefined;
  page: ProductPage = { items: [], total: 0 };

  async findById(): Promise<Product | null> {
    return null;
  }

  async list(limit: number, cursor?: string): Promise<ProductPage> {
    this.lastLimit = limit;
    this.lastCursor = cursor;
    return this.page;
  }

  async save(): Promise<void> {
    return Promise.resolve();
  }
}

describe('ListProducts', () => {
  it('uses the default limit and forwards the opaque cursor', async () => {
    const repository = new RecordingProductRepository();
    repository.page = { items: [], nextCursor: 'cursor-next', total: 42 };
    const useCase = new ListProducts(repository);

    await expect(useCase.execute({ cursor: 'cursor-current' })).resolves.toBe(
      repository.page,
    );
    expect(repository.lastLimit).toBe(20);
    expect(repository.lastCursor).toBe('cursor-current');
  });

  it.each([1, 100])('accepts the inclusive limit %s', async (limit) => {
    const repository = new RecordingProductRepository();

    await new ListProducts(repository).execute({ limit });

    expect(repository.lastLimit).toBe(limit);
  });

  it.each([0, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null])(
    'rejects an invalid limit %s without listing',
    async (limit) => {
      const repository = new RecordingProductRepository();

      await expect(
        new ListProducts(repository).execute({ limit: limit as number }),
      ).rejects.toBeInstanceOf(ValidationApplicationError);
      expect(repository.lastLimit).toBeUndefined();
    },
  );
});
