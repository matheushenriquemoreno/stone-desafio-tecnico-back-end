import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ maxLength: 500, minLength: 1 })
  description!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty({ format: 'uri', maxLength: 2048 })
  imageUrl!: string;

  @ApiProperty({ maxLength: 100, minLength: 2 })
  name!: string;

  @ApiProperty({ example: 99.9, type: Number })
  price!: number;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
