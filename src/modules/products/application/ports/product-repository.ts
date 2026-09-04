import type { Product, ProductEditableField } from '../../domain/product';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductPage {
  readonly items: readonly Product[];
  readonly nextCursor?: string;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  list(limit: number, cursor?: string): Promise<ProductPage>;
  save(product: Product): Promise<void>;
}

export interface ProductMaintenanceRepository extends ProductRepository {
  delete(id: string): Promise<boolean>;
  update(
    product: Product,
    changedFields: readonly ProductEditableField[],
  ): Promise<Product | null>;
}
