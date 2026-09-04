import { ServiceUnavailableError } from '../../../../shared/application/errors/application-error';
import {
  APPLICATION_LIFECYCLE,
  type ApplicationLifecycle,
} from '../ports/application-lifecycle';
import { READINESS_PROBE, type ReadinessProbe } from '../ports/readiness-probe';

export interface ReadinessResult {
  readonly status: 'ok';
}

export class CheckReadiness {
  constructor(
    private readonly applicationLifecycle: ApplicationLifecycle,
    private readonly readinessProbe: ReadinessProbe,
  ) {}

  async execute(): Promise<ReadinessResult> {
    if (!this.applicationLifecycle.isInitialized()) {
      throw new ServiceUnavailableError();
    }

    try {
      await this.readinessProbe.check();
    } catch {
      throw new ServiceUnavailableError();
    }

    return { status: 'ok' };
  }
}

export const CHECK_READINESS_DEPENDENCIES = [
  APPLICATION_LIFECYCLE,
  READINESS_PROBE,
] as const;
