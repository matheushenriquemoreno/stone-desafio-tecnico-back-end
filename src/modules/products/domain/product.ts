import { InvalidProductDataError } from './errors/product-domain.error';

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_DESCRIPTION_LENGTH = 1;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 2_048;

export interface ProductProps {
  readonly createdAt: Date;
  readonly description: string;
  readonly id: string;
  readonly imageUrl: string;
  readonly name: string;
  readonly price: number;
  readonly updatedAt: Date;
}

export interface PublicProductData {
  readonly createdAt: string;
  readonly description: string;
  readonly id: string;
  readonly imageUrl: string;
  readonly name: string;
  readonly price: number;
  readonly updatedAt: string;
}

export type ProductEditableField = 'description' | 'imageUrl' | 'name' | 'price';

export interface ProductPatch {
  readonly description?: string;
  readonly imageUrl?: string;
  readonly name?: string;
  readonly price?: number;
}

export interface ProductUpdate {
  readonly changedFields: readonly ProductEditableField[];
  readonly product: Product;
}

const PRODUCT_EDITABLE_FIELDS: readonly ProductEditableField[] = [
  'name',
  'description',
  'price',
  'imageUrl',
];

function validateTextLength(
  value: unknown,
  minimum: number,
  maximum: number,
  code: 'INVALID_DESCRIPTION' | 'INVALID_NAME',
  message: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maximum
  ) {
    throw new InvalidProductDataError(code, message);
  }
}

export function hasAtMostTwoDecimalPlaces(value: number): boolean {
  const representation = value.toString().toLowerCase();
  const [coefficient = representation, exponentText] = representation.split('e');
  const fractionalDigits = coefficient.split('.')[1]?.length ?? 0;

  if (exponentText === undefined) {
    return fractionalDigits <= 2;
  }

  const exponent = Number(exponentText);
  return fractionalDigits - exponent <= 2;
}

function validatePrice(value: unknown): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !hasAtMostTwoDecimalPlaces(value)
  ) {
    throw new InvalidProductDataError(
      'INVALID_PRICE',
      'O preço deve ser maior que zero e ter até duas casas decimais.',
    );
  }
}

function validateImageUrl(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_IMAGE_URL_LENGTH) {
    throw new InvalidProductDataError(
      'INVALID_IMAGE_URL',
      'A URL da imagem deve usar HTTP(S) e ter até 2048 caracteres.',
    );
  }

  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Esquema de URL não permitido.');
    }
  } catch {
    throw new InvalidProductDataError(
      'INVALID_IMAGE_URL',
      'A URL da imagem deve usar HTTP(S) e ter até 2048 caracteres.',
    );
  }
}

function validateIdentifier(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidProductDataError(
      'INVALID_ID',
      'O identificador do produto é obrigatório.',
    );
  }
}

function invalidPatch(): never {
  throw new InvalidProductDataError(
    'INVALID_PATCH',
    'O patch do produto deve conter campos editáveis válidos.',
  );
}

function hasOwnProperty(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

export function getProductPatchFields(patch: unknown): ProductEditableField[] {
  if (typeof patch !== 'object' || patch === null) {
    return invalidPatch();
  }

  const patchObject = patch as Record<string, unknown>;
  const patchKeys = Object.keys(patchObject);

  if (
    patchKeys.length === 0 ||
    patchKeys.some((key) => !PRODUCT_EDITABLE_FIELDS.includes(key as ProductEditableField))
  ) {
    return invalidPatch();
  }

  for (const field of PRODUCT_EDITABLE_FIELDS) {
    if (
      hasOwnProperty(patchObject, field) &&
      (patchObject[field] === undefined || patchObject[field] === null)
    ) {
      return invalidPatch();
    }
  }

  return PRODUCT_EDITABLE_FIELDS.filter((field) => hasOwnProperty(patchObject, field));
}

function validateDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new InvalidProductDataError(
      'INVALID_TIMESTAMP',
      'A data do produto deve ser válida.',
    );
  }
}

export class Product {
  readonly #createdAt: Date;
  readonly #description: string;
  readonly #id: string;
  readonly #imageUrl: string;
  readonly #name: string;
  readonly #price: number;
  readonly #updatedAt: Date;

  private constructor(props: ProductProps) {
    validateIdentifier(props.id);
    validateTextLength(
      props.name,
      MIN_NAME_LENGTH,
      MAX_NAME_LENGTH,
      'INVALID_NAME',
      'O nome deve ter entre 2 e 100 caracteres.',
    );
    validateTextLength(
      props.description,
      MIN_DESCRIPTION_LENGTH,
      MAX_DESCRIPTION_LENGTH,
      'INVALID_DESCRIPTION',
      'A descrição deve ter entre 1 e 500 caracteres.',
    );
    validatePrice(props.price);
    validateImageUrl(props.imageUrl);
    validateDate(props.createdAt);
    validateDate(props.updatedAt);

    this.#createdAt = new Date(props.createdAt);
    this.#description = props.description;
    this.#id = props.id;
    this.#imageUrl = props.imageUrl;
    this.#name = props.name;
    this.#price = props.price;
    this.#updatedAt = new Date(props.updatedAt);
  }

  static create(props: ProductProps): Product {
    return new Product(props);
  }

  applyPatch(patch: ProductPatch, updatedAt: Date): ProductUpdate {
    const changedFields = getProductPatchFields(patch);
    const patchValues = patch as Record<string, unknown>;
    const updatedProduct = Product.create({
      createdAt: this.createdAt,
      description: hasOwnProperty(patchValues, 'description')
        ? (patchValues.description as string)
        : this.description,
      id: this.id,
      imageUrl: hasOwnProperty(patchValues, 'imageUrl')
        ? (patchValues.imageUrl as string)
        : this.imageUrl,
      name: hasOwnProperty(patchValues, 'name')
        ? (patchValues.name as string)
        : this.name,
      price: hasOwnProperty(patchValues, 'price')
        ? (patchValues.price as number)
        : this.price,
      updatedAt,
    });

    return { changedFields, product: updatedProduct };
  }

  get createdAt(): Date {
    return new Date(this.#createdAt);
  }

  get description(): string {
    return this.#description;
  }

  get id(): string {
    return this.#id;
  }

  get imageUrl(): string {
    return this.#imageUrl;
  }

  get name(): string {
    return this.#name;
  }

  get price(): number {
    return this.#price;
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAt);
  }

  toPublicData(): PublicProductData {
    return {
      createdAt: this.#createdAt.toISOString(),
      description: this.#description,
      id: this.#id,
      imageUrl: this.#imageUrl,
      name: this.#name,
      price: this.#price,
      updatedAt: this.#updatedAt.toISOString(),
    };
  }

  toJSON(): PublicProductData {
    return this.toPublicData();
  }
}
