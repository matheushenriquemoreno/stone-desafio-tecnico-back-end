import { ServiceUnavailableError } from '../../../../shared/application/errors/application-error';
import { CheckReadiness } from './check-readiness';

describe('CheckReadiness', () => {
  it('returns the public ready status after initialization and dependency checks', async () => {
    const useCase = new CheckReadiness(
      { isInitialized: () => true },
      { check: async () => {} },
    );

    await expect(useCase.execute()).resolves.toEqual({ status: 'ok' });
  });

  it('returns service unavailable before application initialization', async () => {
    const useCase = new CheckReadiness(
      { isInitialized: () => false },
      { check: async () => {} },
    );

    await expect(useCase.execute()).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('hides unexpected readiness dependency failures', async () => {
    const useCase = new CheckReadiness(
      { isInitialized: () => true },
      {
        check: async () => {
          throw new Error('internal-table-name');
        },
      },
    );

    await expect(useCase.execute()).rejects.toEqual(new ServiceUnavailableError());
  });
});
