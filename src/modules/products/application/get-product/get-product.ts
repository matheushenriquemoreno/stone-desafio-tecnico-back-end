import type { Product } from '../../domain/product';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import type { ProductRepository } from '../ports/product-repository';

export class GetProduct {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);

    if (product === null) {
      throw new ProductNotFoundError();
    }

    return product;
  }
}
