import type { INestApplication } from '@nestjs/common';

export function configureTrustedProxies(
  app: INestApplication,
  trustedProxyIps: readonly string[],
): void {
  const httpServer = app.getHttpAdapter().getInstance() as {
    set(name: string, value: readonly string[]): void;
  };

  httpServer.set('trust proxy', trustedProxyIps);
}
