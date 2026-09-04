import type { Product } from '../../domain/product';

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
