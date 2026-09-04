import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ApiRateLimitResponse } from '../../../shared/presentation/openapi/api-rate-limit-response';

import {
  CheckReadiness,
  type ReadinessResult,
} from '../application/use-cases/check-readiness';

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(private readonly checkReadiness: CheckReadiness) {}

  @Get()
  @ApiOkResponse({ description: 'Estado de prontidão da API.', schema: { example: { status: 'ok' } } })
  @ApiRateLimitResponse()
  check(): Promise<ReadinessResult> {
    return this.checkReadiness.execute();
  }
}
