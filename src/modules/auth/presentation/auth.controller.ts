import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import type { AppConfig } from '../../../shared/infrastructure/configuration';
import { AuthenticateUser } from '../application/authenticate-user/authenticate-user';
import type { RegisterUserOutput } from '../application/register-user/register-user';
import { RegisterUser } from '../application/register-user/register-user';
import { expireAccessTokenCookie, setAccessTokenCookie } from './auth-cookie';
import { LoginDto } from './login.dto';
import { ApiErrorDto } from '../../../shared/presentation/errors/api-error.dto';
import { ApiRateLimitResponse } from '../../../shared/presentation/openapi/api-rate-limit-response';
import { RegisterUserDto } from './register-user.dto';
import { RegisterUserResponseDto } from './register-user.response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticateUser: AuthenticateUser,
    private readonly configService: ConfigService<AppConfig>,
    private readonly registerUser: RegisterUser,
  ) {}

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
  @ApiOperation({ summary: 'Cadastra um usuário sem autenticação automática.' })
  @ApiRateLimitResponse()
  @Post('register')
  register(@Body() input: RegisterUserDto): Promise<RegisterUserOutput> {
    return this.registerUser.execute(input);
  }

  @ApiBadRequestResponse({ description: 'Dados inválidos.', type: ApiErrorDto })
  @ApiForbiddenResponse({
    description: 'Proteção CSRF ou origem inválida.',
    type: ApiErrorDto,
  })
  @ApiNoContentResponse({ description: 'Cookie de autenticação criado.' })
  @ApiOperation({ summary: 'Autentica e cria o cookie de acesso.' })
  @ApiRateLimitResponse()
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas.', type: ApiErrorDto })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { accessToken } = await this.authenticateUser.execute(input);
    setAccessTokenCookie(response, accessToken, this.cookieSettings());
  }

  @ApiForbiddenResponse({
    description: 'Proteção CSRF ou origem inválida.',
    type: ApiErrorDto,
  })
  @ApiNoContentResponse({ description: 'Cookie de autenticação expirado.' })
  @ApiOperation({ summary: 'Expira o cookie de autenticação de forma idempotente.' })
  @ApiRateLimitResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): void {
    expireAccessTokenCookie(response, this.cookieSettings());
  }

  private cookieSettings(): { cookieName: string; cookieSecure: boolean } {
    return {
      cookieName: this.configService.getOrThrow('cookieName'),
      cookieSecure: this.configService.getOrThrow('cookieSecure'),
    };
  }
}
