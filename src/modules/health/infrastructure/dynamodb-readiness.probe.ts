import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../shared/infrastructure/configuration';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  type DocumentClient,
} from '../../../shared/infrastructure/dynamodb/dynamodb.tokens';
import type { ReadinessProbe } from '../application/ports/readiness-probe';

@Injectable()
export class DynamoDbReadinessProbe implements ReadinessProbe {
  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly client: DocumentClient,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  async check(): Promise<void> {
    const tableNames = [
      this.configService.getOrThrow('usersTableName'),
      this.configService.getOrThrow('productsTableName'),
    ];
    const descriptions = await Promise.all(
      tableNames.map((tableName) =>
        this.client.send(new DescribeTableCommand({ TableName: tableName })),
      ),
    );

    if (
      descriptions.some((description) => description.Table?.TableStatus !== 'ACTIVE')
    ) {
      throw new Error('Uma tabela necessária ainda não está ativa.');
    }
  }
}
