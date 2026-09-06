import { ApiTooManyRequestsResponse } from '@nestjs/swagger';

import { ApiErrorDto } from '../errors/api-error.dto';

export function ApiRateLimitResponse(): MethodDecorator {
  return ApiTooManyRequestsResponse({
    description: 'Limite de requisições excedido.',
    headers: {
      'Retry-After': {
        description: 'Segundos inteiros restantes na janela atual.',
        schema: { minimum: 1, type: 'integer' },
      },
    },
    type: ApiErrorDto,
  });
}
