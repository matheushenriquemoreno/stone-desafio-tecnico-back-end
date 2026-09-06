import type { Clock } from '../../../../shared/application/ports/clock';
import { InvalidProductPatchError } from '../errors/invalid-product-patch.error';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import {
  getProductPatchFields,
  type Product,
  type ProductPatch,
} from '../../domain/product';
import { InvalidProductDataError } from '../../domain/errors/product-domain.error';
import type { ProductUpdateRepository } from '../ports/product-repository';

export interface UpdateProductInput {
  readonly patch: ProductPatch;
  readonly productId: string;
}

export class UpdateProduct {
  constructor(
    private readonly clock: Clock,
    private readonly productRepository: ProductUpdateRepository,
  ) {}

  async execute(input: UpdateProductInput): Promise<Product> {
    let changedFields: ReturnType<typeof getProductPatchFields>;

    try {
      changedFields = getProductPatchFields(input.patch);
    } catch (error: unknown) {
      if (error instanceof InvalidProductDataError) {
        throw new InvalidProductPatchError();
      }

      throw error;
    }

    const existingProduct = await this.productRepository.findById(input.productId);

    if (existingProduct === null) {
      throw new ProductNotFoundError();
    }

    let update: ReturnType<typeof existingProduct.applyPatch>;

    try {
      update = existingProduct.applyPatch(input.patch, this.clock.now());
    } catch (error: unknown) {
      if (error instanceof InvalidProductDataError) {
        throw new InvalidProductPatchError();
      }

      throw error;
    }

    const updatedProduct = await this.productRepository.update(
      update.product,
      changedFields,
    );

    if (updatedProduct === null) {
      throw new ProductNotFoundError();
    }

    return updatedProduct;
  }
}
