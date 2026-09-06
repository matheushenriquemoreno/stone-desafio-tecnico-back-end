import { ApplicationError } from '../../../../shared/application/errors/application-error';

export class ProductNotFoundError extends ApplicationError {
  constructor() {
    super({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Produto não encontrado.',
      statusCode: 404,
    });
    this.name = 'ProductNotFoundError';
  }
}
