import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { PublicProductData } from '../domain/product';
import { ProductResponseDto } from './product.response.dto';

export interface PublicProductsPage {
  readonly items: readonly PublicProductData[];
  readonly nextCursor?: string;
  readonly total: number;
}

export class ProductsPageResponseDto implements PublicProductsPage {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: readonly PublicProductData[];

  @ApiProperty({
    description: 'Quantidade total de produtos existentes no catálogo.',
    example: 21,
    minimum: 0,
    type: 'integer',
  })
  total!: number;

  @ApiPropertyOptional({ description: 'Cursor opaco para a próxima página.' })
  nextCursor?: string;
}
