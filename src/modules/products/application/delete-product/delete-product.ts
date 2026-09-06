import { ProductNotFoundError } from '../errors/product-not-found.error';
import type { ProductMaintenanceRepository } from '../ports/product-repository';

export class DeleteProduct {
  constructor(private readonly productRepository: ProductMaintenanceRepository) {}

  async execute(productId: string): Promise<void> {
    const deleted = await this.productRepository.delete(productId);

    if (!deleted) {
      throw new ProductNotFoundError();
    }
  }
}
