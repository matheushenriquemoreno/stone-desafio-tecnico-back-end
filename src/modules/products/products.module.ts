import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CLOCK, type Clock } from '../../shared/application/ports/clock';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../shared/application/ports/id-generator';
import { SystemClock } from '../../shared/infrastructure/clock/system-clock';
import type { AppConfig } from '../../shared/infrastructure/configuration';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  type DocumentClient,
} from '../../shared/infrastructure/dynamodb/dynamodb.tokens';
import { DynamoDbModule } from '../../shared/infrastructure/dynamodb/dynamodb.module';
import { SecureIdGenerator } from '../../shared/infrastructure/identifiers/secure-id-generator';
import { AuthModule } from '../auth/auth.module';
import { CreateProduct } from './application/create-product/create-product';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from './application/ports/product-repository';
import { DynamoDbProductRepository } from './infrastructure/persistence/dynamodb-product.repository';
import { ProductsController } from './presentation/products.controller';

@Module({
  controllers: [ProductsController],
  imports: [AuthModule, ConfigModule, DynamoDbModule],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: SecureIdGenerator },
    {
      inject: [CLOCK, ID_GENERATOR, PRODUCT_REPOSITORY],
      provide: CreateProduct,
      useFactory: (
        clock: Clock,
        idGenerator: IdGenerator,
        productRepository: ProductRepository,
      ): CreateProduct => new CreateProduct(clock, idGenerator, productRepository),
    },
    {
      inject: [DYNAMODB_DOCUMENT_CLIENT, ConfigService],
      provide: PRODUCT_REPOSITORY,
      useFactory: (
        client: DocumentClient,
        configService: ConfigService<AppConfig>,
      ): ProductRepository =>
        new DynamoDbProductRepository(
          client,
          configService.getOrThrow('productsTableName'),
        ),
    },
  ],
})
export class ProductsModule {}
