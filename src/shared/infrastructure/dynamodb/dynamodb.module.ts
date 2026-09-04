import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { AppConfig } from '../configuration';
import { createDynamoDbDocumentClient } from './dynamodb.client';
import { DYNAMODB_DOCUMENT_CLIENT, type DocumentClient } from './dynamodb.tokens';

@Module({
  exports: [DYNAMODB_DOCUMENT_CLIENT],
  imports: [ConfigModule],
  providers: [
    {
      inject: [ConfigService],
      provide: DYNAMODB_DOCUMENT_CLIENT,
      useFactory: (configService: ConfigService<AppConfig>): DocumentClient =>
        createDynamoDbDocumentClient({
          allowedOrigins: configService.getOrThrow('allowedOrigins'),
          awsRegion: configService.getOrThrow('awsRegion'),
          cookieName: configService.getOrThrow('cookieName'),
          cookieSecure: configService.getOrThrow('cookieSecure'),
          dynamodbEndpoint: configService.getOrThrow('dynamodbEndpoint'),
          dynamodbTablePrefix: configService.get('dynamodbTablePrefix'),
          jwtAccessTtlSeconds: configService.getOrThrow('jwtAccessTtlSeconds'),
          jwtAudience: configService.getOrThrow('jwtAudience'),
          jwtIssuer: configService.getOrThrow('jwtIssuer'),
          jwtSecret: configService.getOrThrow('jwtSecret'),
          nodeEnv: configService.getOrThrow('nodeEnv'),
          port: configService.getOrThrow('port'),
          productsTableName: configService.getOrThrow('productsTableName'),
          usersTableName: configService.getOrThrow('usersTableName'),
        }),
    },
  ],
})
export class DynamoDbModule {}
