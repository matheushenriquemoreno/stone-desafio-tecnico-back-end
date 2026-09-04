import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';

import { ApiErrorDto } from '../../../shared/presentation/errors/api-error.dto';

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
  @ApiTooManyRequestsResponse({ description: 'Limite de requisições excedido.', type: ApiErrorDto })
  check(): Promise<ReadinessResult> {
    return this.checkReadiness.execute();
  }
}
