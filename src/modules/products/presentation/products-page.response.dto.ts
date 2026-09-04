import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { PublicProductData } from '../domain/product';
import { ProductResponseDto } from './product.response.dto';

export interface PublicProductsPage {
  readonly items: readonly PublicProductData[];
  readonly nextCursor?: string;
}

export class ProductsPageResponseDto implements PublicProductsPage {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: readonly PublicProductData[];

  @ApiPropertyOptional({ description: 'Cursor opaco para a próxima página.' })
  nextCursor?: string;
}
