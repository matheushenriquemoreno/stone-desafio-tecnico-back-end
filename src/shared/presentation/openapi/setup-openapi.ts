import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupOpenApi(app: INestApplication, cookieName: string): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Stone Technical Challenge API')
    .setDescription('API de cadastro, autenticação e catálogo de produtos.')
    .setVersion('1.0.0')
    .addCookieAuth(cookieName)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
