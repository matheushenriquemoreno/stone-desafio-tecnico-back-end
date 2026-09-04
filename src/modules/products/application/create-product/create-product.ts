import type { Clock } from '../../../../shared/application/ports/clock';
import type { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { Product } from '../../domain/product';
import type { ProductRepository } from '../ports/product-repository';

export interface CreateProductInput {
  readonly description: string;
  readonly imageUrl: string;
  readonly name: string;
  readonly price: number;
}

export class CreateProduct {
  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    const now = this.clock.now();
    const product = Product.create({
      createdAt: now,
      description: input.description,
      id: this.idGenerator.generate(),
      imageUrl: input.imageUrl,
      name: input.name,
      price: input.price,
      updatedAt: now,
    });

    await this.productRepository.save(product);

    return product;
  }
}
