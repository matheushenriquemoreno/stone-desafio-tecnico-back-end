import { Controller, Get } from '@nestjs/common';

import {
  CheckReadiness,
  type ReadinessResult,
} from '../application/use-cases/check-readiness';

@Controller('health')
export class HealthController {
  constructor(private readonly checkReadiness: CheckReadiness) {}

  @Get()
  check(): Promise<ReadinessResult> {
    return this.checkReadiness.execute();
  }
}
