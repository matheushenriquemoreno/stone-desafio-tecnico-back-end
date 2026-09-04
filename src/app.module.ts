import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';
import { CLOCK } from './shared/application/ports/clock';
import { ID_GENERATOR } from './shared/application/ports/id-generator';
import { REQUEST_LOGGER } from './shared/application/ports/request-logger';
import { SystemClock } from './shared/infrastructure/clock/system-clock';
import {
  configuration,
  validateEnvironment,
} from './shared/infrastructure/configuration';
import { SecureIdGenerator } from './shared/infrastructure/identifiers/secure-id-generator';
import { ConsoleRequestLogger } from './shared/infrastructure/logging/console-request.logger';
import { DynamoDbModule } from './shared/infrastructure/dynamodb/dynamodb.module';
import { ApiExceptionFilter } from './shared/presentation/errors/api-exception.filter';
import { CsrfProtectionMiddleware } from './shared/presentation/http/csrf-protection.middleware';
import { CorrelationIdMiddleware } from './shared/presentation/http/correlation-id.middleware';
import { RequestLoggingInterceptor } from './shared/presentation/logging/request-logging.interceptor';

@Module({
  imports: [
    DynamoDbModule,
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    AuthModule,
    HealthModule,
    ProductsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: SecureIdGenerator },
    { provide: REQUEST_LOGGER, useClass: ConsoleRequestLogger },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware, CsrfProtectionMiddleware).forRoutes('*');
  }
}
