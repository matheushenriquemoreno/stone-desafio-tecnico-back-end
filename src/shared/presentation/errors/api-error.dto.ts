import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiFieldErrorDto {
  @ApiProperty({ example: 'name' })
  field!: string;

  @ApiProperty({ example: 'INVALID_VALUE' })
  code!: string;

  @ApiProperty({ example: 'O campo possui um valor inválido.' })
  message!: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'generated-correlation-id' })
  correlationId!: string;

  @ApiPropertyOptional({ type: [ApiFieldErrorDto] })
  errors?: ApiFieldErrorDto[];

  @ApiProperty({ example: 'A requisição contém dados inválidos.' })
  message!: string;

  @ApiProperty({ example: 400 })
  statusCode!: number;
}
