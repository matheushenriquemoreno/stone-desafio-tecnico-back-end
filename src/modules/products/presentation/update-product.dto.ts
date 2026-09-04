import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';

import type { ProductPatch } from '../domain/product';
import { MaxTwoDecimalPlacesConstraint } from './price-decimal.validator';

export class UpdateProductDto implements ProductPatch {
  @ApiPropertyOptional({ maxLength: 500, minLength: 1 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @MinLength(1)
  declare description?: string;

  @ApiPropertyOptional({ format: 'uri', maxLength: 2048, minLength: 1 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @MinLength(1)
  declare imageUrl?: string;

  @ApiPropertyOptional({ maxLength: 100, minLength: 2 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @MinLength(2)
  declare name?: string;

  @ApiPropertyOptional({ example: 109.9, minimum: 0, type: Number })
  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  @Validate(MaxTwoDecimalPlacesConstraint)
  declare price?: number;
}
