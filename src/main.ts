import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { createAppConfig, type AppConfig } from './shared/infrastructure/configuration';
import { createCorsOptions } from './shared/presentation/http/cors-options';
import { configureTrustedProxies } from './shared/presentation/http/trusted-proxies';
import { setupOpenApi } from './shared/presentation/openapi/setup-openapi';
import { PublicValidationPipe } from './shared/presentation/validation/public-validation.pipe';

export async function bootstrap(): Promise<void> {
  createAppConfig(process.env);
  const { AppModule } = await import('./app.module');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig>);
  configureTrustedProxies(app, configService.getOrThrow('trustedProxyIps'));
  app.enableCors(createCorsOptions(configService.getOrThrow('allowedOrigins')));
  app.useGlobalPipes(new PublicValidationPipe());
  const port = configService.getOrThrow<number>('port');
  setupOpenApi(app, configService.getOrThrow('cookieName'));

  await app.listen(port);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Falha ao iniciar a aplicação.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
