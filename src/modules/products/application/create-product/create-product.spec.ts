import { FixedClock } from '../../../../shared/application/testing/fixed-clock';
import { FixedIdGenerator } from '../../../../shared/application/testing/fixed-id-generator';
import type { Product } from '../../domain/product';
import type { ProductRepository } from '../ports/product-repository';
import { CreateProduct, type CreateProductInput } from './create-product';

class RecordingProductRepository implements ProductRepository {
  savedProduct: Product | undefined;
  error: Error | undefined;

  async findById(): Promise<Product | null> {
    return null;
  }

  async list(): Promise<{ items: readonly Product[] }> {
    return { items: [] };
  }

  async save(product: Product): Promise<void> {
    if (this.error !== undefined) {
      throw this.error;
    }

    this.savedProduct = product;
  }
}

function validInput(): CreateProductInput {
  return {
    description: 'Descrição do produto',
    imageUrl: 'https://example.com/product.png',
    name: 'Produto',
    price: 99.9,
  };
}

function createUseCase(repository: RecordingProductRepository): CreateProduct {
  return new CreateProduct(
    new FixedClock(new Date('2026-09-04T12:00:00.000Z')),
    new FixedIdGenerator(['product-123']),
    repository,
  );
}

describe('CreateProduct', () => {
  it('generates identity and dates, persists once and returns the product', async () => {
    const repository = new RecordingProductRepository();
    const useCase = createUseCase(repository);

    const product = await useCase.execute(validInput());

    expect(product.toPublicData()).toEqual({
      createdAt: '2026-09-04T12:00:00.000Z',
      description: 'Descrição do produto',
      id: 'product-123',
      imageUrl: 'https://example.com/product.png',
      name: 'Produto',
      price: 99.9,
      updatedAt: '2026-09-04T12:00:00.000Z',
    });
    expect(repository.savedProduct).toBe(product);
  });

  it('validates through the domain before persisting', async () => {
    const repository = new RecordingProductRepository();
    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({ ...validInput(), price: 10.001 }),
    ).rejects.toThrow('duas casas decimais');
    expect(repository.savedProduct).toBeUndefined();
  });

  it('propagates persistence failures after product creation', async () => {
    const repository = new RecordingProductRepository();
    repository.error = new Error('DynamoDB unavailable');
    const useCase = createUseCase(repository);

    await expect(useCase.execute(validInput())).rejects.toBe(repository.error);
  });
});
