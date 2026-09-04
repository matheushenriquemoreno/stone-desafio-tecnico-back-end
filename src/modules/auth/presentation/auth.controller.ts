import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { RegisterUserOutput } from '../application/register-user/register-user';
import { RegisterUser } from '../application/register-user/register-user';
import { ApiErrorDto } from '../../../shared/presentation/errors/api-error.dto';
import { RegisterUserDto } from './register-user.dto';
import { RegisterUserResponseDto } from './register-user.response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly registerUser: RegisterUser) {}

  @ApiBadRequestResponse({ description: 'Dados inválidos.', type: ApiErrorDto })
  @ApiConflictResponse({
    description: 'O e-mail já está cadastrado.',
    type: ApiErrorDto,
  })
  @ApiCreatedResponse({ description: 'Usuário criado.', type: RegisterUserResponseDto })
  @ApiForbiddenResponse({
    description: 'Proteção CSRF ou origem inválida.',
    type: ApiErrorDto,
  })
  @ApiHeader({
    description: 'Deve ser enviado com o valor literal 1.',
    name: 'X-CSRF-Protection',
    required: true,
  })
  @ApiOperation({ summary: 'Cadastra um usuário sem autenticação automática.' })
  @Post('register')
  register(@Body() input: RegisterUserDto): Promise<RegisterUserOutput> {
    return this.registerUser.execute(input);
  }
}
