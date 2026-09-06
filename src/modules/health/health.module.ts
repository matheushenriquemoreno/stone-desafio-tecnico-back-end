import { Module } from '@nestjs/common';

import { DynamoDbModule } from '../../shared/infrastructure/dynamodb/dynamodb.module';
import { CheckReadiness } from './application/use-cases/check-readiness';
import { APPLICATION_LIFECYCLE } from './application/ports/application-lifecycle';
import { READINESS_PROBE } from './application/ports/readiness-probe';
import { DynamoDbReadinessProbe } from './infrastructure/dynamodb-readiness.probe';
import { NestApplicationLifecycle } from './infrastructure/nest-application-lifecycle';
import { HealthController } from './presentation/health.controller';

@Module({
  controllers: [HealthController],
  imports: [DynamoDbModule],
  providers: [
    {
      inject: [APPLICATION_LIFECYCLE, READINESS_PROBE],
      provide: CheckReadiness,
      useFactory: (applicationLifecycle, readinessProbe) =>
        new CheckReadiness(applicationLifecycle, readinessProbe),
    },
    { provide: APPLICATION_LIFECYCLE, useClass: NestApplicationLifecycle },
    { provide: READINESS_PROBE, useClass: DynamoDbReadinessProbe },
  ],
})
export class HealthModule {}
