import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

function parseIntegerQuery(value: unknown): unknown {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return value;
  }

  return Number(value);
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1, type: Number })
  @Transform(({ value }: { value: unknown }): unknown => parseIntegerQuery(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor opaco retornado pela página anterior.' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  cursor?: string;
}
