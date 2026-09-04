import { ValidationApplicationError } from '../../../../shared/application/errors/application-error';
import type { ProductPage, ProductRepository } from '../ports/product-repository';

export const DEFAULT_PRODUCT_PAGE_LIMIT = 20;
export const MAX_PRODUCT_PAGE_LIMIT = 100;
export const MIN_PRODUCT_PAGE_LIMIT = 1;

export interface ListProductsInput {
  readonly cursor?: string;
  readonly limit?: number;
}

function invalidLimit(): never {
  throw new ValidationApplicationError([
    {
      code: 'INVALID_VALUE',
      field: 'limit',
      message: 'O limite deve ser um inteiro entre 1 e 100.',
    },
  ]);
}

function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_PRODUCT_PAGE_LIMIT;
  }

  if (
    !Number.isInteger(limit) ||
    limit < MIN_PRODUCT_PAGE_LIMIT ||
    limit > MAX_PRODUCT_PAGE_LIMIT
  ) {
    return invalidLimit();
  }

  return limit;
}

export class ListProducts {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: ListProductsInput = {}): Promise<ProductPage> {
    return this.productRepository.list(resolveLimit(input.limit), input.cursor);
  }
}
