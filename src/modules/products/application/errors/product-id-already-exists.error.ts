export class ProductIdAlreadyExistsError extends Error {
  constructor() {
    super('O identificador do produto já existe.');
    this.name = 'ProductIdAlreadyExistsError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
