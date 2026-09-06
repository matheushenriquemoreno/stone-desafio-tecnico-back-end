export type ProductDomainErrorCode =
  | 'INVALID_DESCRIPTION'
  | 'INVALID_ID'
  | 'INVALID_IMAGE_URL'
  | 'INVALID_NAME'
  | 'INVALID_PATCH'
  | 'INVALID_PRICE'
  | 'INVALID_TIMESTAMP';

export class InvalidProductDataError extends Error {
  readonly code: ProductDomainErrorCode;

  constructor(code: ProductDomainErrorCode, message: string) {
    super(message);
    this.name = 'InvalidProductDataError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
