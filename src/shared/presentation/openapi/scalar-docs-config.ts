import type { INestApplication } from '@nestjs/common';
import { apiReference } from '@scalar/nestjs-api-reference'

export function setupScalarDocs(app: INestApplication): void {
    app.use(
        '/',
        apiReference({
            url: '/docs-json',
        }),
    )
}