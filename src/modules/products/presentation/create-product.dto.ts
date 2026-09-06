import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNumber, IsNotEmpty, IsPositive, IsString, IsUrl, MaxLength, MinLength, Validate } from 'class-validator';

import { MaxTwoDecimalPlacesConstraint } from './price-decimal.validator';

export class CreateProductDto {
  @ApiProperty({ maxLength: 500, minLength: 1 })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @MinLength(1)
  description!: string;

  @ApiProperty({ format: 'uri', maxLength: 2048, minLength: 1 })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @MinLength(1)
  imageUrl!: string;

  @ApiProperty({ maxLength: 100, minLength: 2 })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 99.9, minimum: 0, type: Number })
  @IsDefined()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  @Validate(MaxTwoDecimalPlacesConstraint)
  price!: number;
}
