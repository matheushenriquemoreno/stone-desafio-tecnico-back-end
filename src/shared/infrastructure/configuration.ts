import 'reflect-metadata';

import { isIP } from 'node:net';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import type { ConfigFactory } from '@nestjs/config';

import { resolveTableName } from './dynamodb/table-names';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly port: number;
  readonly dynamodbEndpoint: string;
  readonly dynamodbTablePrefix?: string;
  readonly awsRegion: string;
  readonly usersTableName: string;
  readonly productsTableName: string;
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly jwtAccessTtlSeconds: number;
  readonly allowedOrigins: readonly string[];
  readonly trustedProxyIps: readonly string[];
  readonly cookieName: string;
  readonly cookieSecure: boolean;
}

type EnvironmentInput = Record<string, unknown>;

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  @IsNotEmpty()
  NODE_ENV!: NodeEnvironment;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  DYNAMODB_ENDPOINT!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  AWS_REGION!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  USERS_TABLE_NAME!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  PRODUCTS_TABLE_NAME!: string;

  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]{1,50}$/)
  DYNAMODB_TABLE_PREFIX?: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  JWT_ISSUER!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  JWT_AUDIENCE!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(900)
  JWT_ACCESS_TTL_SECONDS!: number;

  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false }, { each: true })
  ALLOWED_ORIGINS!: string[];

  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      return value;
    }

    return value
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  TRUSTED_PROXY_IPS?: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  COOKIE_NAME!: string;

  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  COOKIE_SECURE!: boolean;
}

interface ValidatedEnvironment {
  readonly NODE_ENV: NodeEnvironment;
  readonly PORT: number;
  readonly DYNAMODB_ENDPOINT: string;
  readonly DYNAMODB_TABLE_PREFIX?: string;
  readonly AWS_REGION: string;
  readonly USERS_TABLE_NAME: string;
  readonly PRODUCTS_TABLE_NAME: string;
  readonly JWT_SECRET: string;
  readonly JWT_ISSUER: string;
  readonly JWT_AUDIENCE: string;
  readonly JWT_ACCESS_TTL_SECONDS: number;
  readonly ALLOWED_ORIGINS: string[];
  readonly TRUSTED_PROXY_IPS?: string[];
  readonly COOKIE_NAME: string;
  readonly COOKIE_SECURE: boolean;
}

function parseEnvironment(input: EnvironmentInput): ValidatedEnvironment {
  const variables = plainToInstance(EnvironmentVariables, input, {
    enableImplicitConversion: false,
  });
  const validationErrors = validateSync(variables, {
    forbidUnknownValues: true,
    stopAtFirstError: false,
    whitelist: true,
  });
  const invalidFields = new Set(validationErrors.map((error) => error.property));

  if (variables.NODE_ENV === 'production' && variables.JWT_ACCESS_TTL_SECONDS !== 900) {
    invalidFields.add('JWT_ACCESS_TTL_SECONDS');
  }

  if (
    variables.NODE_ENV === 'production' &&
    variables.COOKIE_NAME !== '__Host-stone_access_token'
  ) {
    invalidFields.add('COOKIE_NAME');
  }

  if (variables.NODE_ENV === 'production' && variables.COOKIE_SECURE !== true) {
    invalidFields.add('COOKIE_SECURE');
  }

  if (variables.TRUSTED_PROXY_IPS?.some((ip) => isIP(ip) === 0)) {
    invalidFields.add('TRUSTED_PROXY_IPS');
  }

  if (invalidFields.size > 0) {
    throw new Error(
      `Configuração de ambiente inválida: ${Array.from(invalidFields).sort().join(', ')}.`,
    );
  }

  return {
    ALLOWED_ORIGINS: variables.ALLOWED_ORIGINS,
    AWS_REGION: variables.AWS_REGION,
    COOKIE_NAME: variables.COOKIE_NAME,
    COOKIE_SECURE: variables.COOKIE_SECURE,
    DYNAMODB_ENDPOINT: variables.DYNAMODB_ENDPOINT,
    DYNAMODB_TABLE_PREFIX: variables.DYNAMODB_TABLE_PREFIX,
    JWT_ACCESS_TTL_SECONDS: variables.JWT_ACCESS_TTL_SECONDS,
    JWT_AUDIENCE: variables.JWT_AUDIENCE,
    JWT_ISSUER: variables.JWT_ISSUER,
    JWT_SECRET: variables.JWT_SECRET,
    NODE_ENV: variables.NODE_ENV,
    PORT: variables.PORT,
    PRODUCTS_TABLE_NAME: variables.PRODUCTS_TABLE_NAME,
    TRUSTED_PROXY_IPS: variables.TRUSTED_PROXY_IPS,
    USERS_TABLE_NAME: variables.USERS_TABLE_NAME,
  };
}

export function validateEnvironment(input: EnvironmentInput): EnvironmentInput {
  return parseEnvironment(input) as unknown as EnvironmentInput;
}

export function createAppConfig(input: EnvironmentInput): AppConfig {
  const environment = parseEnvironment(input);

  return {
    allowedOrigins: environment.ALLOWED_ORIGINS,
    awsRegion: environment.AWS_REGION,
    cookieName: environment.COOKIE_NAME,
    cookieSecure: environment.COOKIE_SECURE,
    dynamodbEndpoint: environment.DYNAMODB_ENDPOINT,
    dynamodbTablePrefix: environment.DYNAMODB_TABLE_PREFIX,
    jwtAccessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
    jwtAudience: environment.JWT_AUDIENCE,
    jwtIssuer: environment.JWT_ISSUER,
    jwtSecret: environment.JWT_SECRET,
    nodeEnv: environment.NODE_ENV,
    port: environment.PORT,
    productsTableName: resolveTableName(
      environment.PRODUCTS_TABLE_NAME,
      environment.DYNAMODB_TABLE_PREFIX,
    ),
    trustedProxyIps: environment.TRUSTED_PROXY_IPS ?? [],
    usersTableName: resolveTableName(
      environment.USERS_TABLE_NAME,
      environment.DYNAMODB_TABLE_PREFIX,
    ),
  };
}

export const configuration: ConfigFactory<AppConfig> = () =>
  createAppConfig(process.env);
