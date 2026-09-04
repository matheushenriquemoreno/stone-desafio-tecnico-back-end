import { FixedClock } from '../../../../shared/application/testing/fixed-clock';
import { Product } from '../../domain/product';
import type {
  ProductEditableField,
  ProductPatch,
} from '../../domain/product';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import type {
  ProductUpdateRepository,
  ProductPage,
} from '../ports/product-repository';
import { UpdateProduct } from './update-product';

class RecordingProductRepository implements ProductUpdateRepository {
  product: Product | null = null;
  updatedProduct: Product | undefined;
  changedFields: readonly ProductEditableField[] | undefined;
  updateResult: Product | null | undefined;

  async findById(): Promise<Product | null> {
    return this.product;
  }

  async list(): Promise<ProductPage> {
    return { items: [] };
  }

  async save(): Promise<void> {
    return Promise.resolve();
  }

  async update(
    product: Product,
    changedFields: readonly ProductEditableField[],
  ): Promise<Product | null> {
    this.updatedProduct = product;
    this.changedFields = changedFields;
    return this.updateResult === undefined ? product : this.updateResult;
  }

}

function createProduct(): Product {
  return Product.create({
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    description: 'Descrição original',
    id: 'product-123',
    imageUrl: 'https://example.com/original.png',
    name: 'Produto original',
    price: 99.9,
    updatedAt: new Date('2026-09-04T12:00:00.000Z'),
  });
}

function createUseCase(repository: RecordingProductRepository): UpdateProduct {
  return new UpdateProduct(
    new FixedClock(new Date('2026-09-04T13:00:00.000Z')),
    repository,
  );
}

describe('UpdateProduct', () => {
  it.each([
    { field: 'name', patch: { name: 'Produto novo' } },
    { field: 'description', patch: { description: 'Descrição nova' } },
    { field: 'price', patch: { price: 109.9 } },
    { field: 'imageUrl', patch: { imageUrl: 'https://example.com/new.png' } },
  ])('updates only the received $field field', async ({ patch }) => {
    const repository = new RecordingProductRepository();
    repository.product = createProduct();

    const updatedProduct = await createUseCase(repository).execute({
      patch,
      productId: 'product-123',
    });

    expect(updatedProduct.toPublicData()).toEqual({
      createdAt: '2026-09-04T12:00:00.000Z',
      description: patch.description ?? 'Descrição original',
      id: 'product-123',
      imageUrl: patch.imageUrl ?? 'https://example.com/original.png',
      name: patch.name ?? 'Produto original',
      price: patch.price ?? 99.9,
      updatedAt: '2026-09-04T13:00:00.000Z',
    });
    expect(repository.changedFields).toEqual([Object.keys(patch)[0]]);
  });

  it('updates combinations while preserving creation time and omitted fields', async () => {
    const repository = new RecordingProductRepository();
    repository.product = createProduct();
    const patch: ProductPatch = {
      description: 'Descrição combinada',
      price: 109.9,
    };

    const updatedProduct = await createUseCase(repository).execute({
      patch,
      productId: 'product-123',
    });

    expect(updatedProduct.toPublicData()).toEqual({
      createdAt: '2026-09-04T12:00:00.000Z',
      description: 'Descrição combinada',
      id: 'product-123',
      imageUrl: 'https://example.com/original.png',
      name: 'Produto original',
      price: 109.9,
      updatedAt: '2026-09-04T13:00:00.000Z',
    });
    expect(repository.changedFields).toEqual(['description', 'price']);
  });

  it.each([{}, { name: null }, { unknown: 'rejected' }])(
    'rejects an invalid patch before updating',
    async (patch) => {
      const repository = new RecordingProductRepository();
      repository.product = createProduct();

      await expect(
        createUseCase(repository).execute({
          patch: patch as ProductPatch,
          productId: 'product-123',
        }),
      ).rejects.toThrow('patch do produto é inválido');
      expect(repository.updatedProduct).toBeUndefined();
    },
  );

  it.each([
    { price: 10.001 },
    { name: 'A' },
    { description: '' },
    { imageUrl: 'ftp://example.com/image.png' },
  ])('rejects a patch value that violates the product invariant', async (patch) => {
    const repository = new RecordingProductRepository();
    repository.product = createProduct();

    await expect(
      createUseCase(repository).execute({
        patch: patch as ProductPatch,
        productId: 'product-123',
      }),
    ).rejects.toThrow('patch do produto é inválido');
    expect(repository.updatedProduct).toBeUndefined();
  });

  it('maps an item that disappeared before the conditional update to not found', async () => {
    const repository = new RecordingProductRepository();
    repository.product = createProduct();
    repository.updateResult = null;

    await expect(
      createUseCase(repository).execute({
        patch: { price: 109.9 },
        productId: 'product-123',
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
