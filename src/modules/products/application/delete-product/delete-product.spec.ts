import type { Product } from '../../domain/product';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import type {
  ProductMaintenanceRepository,
  ProductPage,
} from '../ports/product-repository';
import { DeleteProduct } from './delete-product';

class RecordingProductRepository implements ProductMaintenanceRepository {
  deletedId: string | undefined;
  deleteResult = true;

  async findById(): Promise<Product | null> {
    return null;
  }

  async list(): Promise<ProductPage> {
    return { items: [] };
  }

  async save(): Promise<void> {
    return Promise.resolve();
  }

  async update(): Promise<Product | null> {
    return null;
  }

  async delete(id: string): Promise<boolean> {
    this.deletedId = id;
    return this.deleteResult;
  }
}

describe('DeleteProduct', () => {
  it('deletes the requested product through the repository', async () => {
    const repository = new RecordingProductRepository();

    await expect(new DeleteProduct(repository).execute('product-123')).resolves.toBeUndefined();

    expect(repository.deletedId).toBe('product-123');
  });

  it('maps a conditional absence to PRODUCT_NOT_FOUND', async () => {
    const repository = new RecordingProductRepository();
    repository.deleteResult = false;

    await expect(
      new DeleteProduct(repository).execute('missing-product'),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
