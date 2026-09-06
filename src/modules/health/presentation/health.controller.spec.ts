import type { CheckReadiness } from '../application/use-cases/check-readiness';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('delegates the health request and returns the public status', async () => {
    const readiness = {
      execute: async () => ({ status: 'ok' as const }),
    } as unknown as CheckReadiness;
    const controller = new HealthController(readiness);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });
});
