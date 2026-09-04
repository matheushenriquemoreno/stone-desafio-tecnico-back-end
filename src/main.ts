import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { createAppConfig, type AppConfig } from './shared/infrastructure/configuration';
import { PublicValidationPipe } from './shared/presentation/validation/public-validation.pipe';

export async function bootstrap(): Promise<void> {
  createAppConfig(process.env);
  const { AppModule } = await import('./app.module');

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new PublicValidationPipe());
  const configService = app.get(ConfigService<AppConfig>);
  const port = configService.getOrThrow<number>('port');

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
