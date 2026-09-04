import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../../../shared/presentation/errors/api-error.dto';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard';
import { CreateProduct } from '../application/create-product/create-product';
import type { PublicProductData } from '../domain/product';
import { CreateProductDto } from './create-product.dto';
import { ProductResponseDto } from './product.response.dto';

@ApiCookieAuth()
@ApiTags('products')
@Controller('products')
@UseGuards(AccessTokenGuard)
export class ProductsController {
  constructor(private readonly createProduct: CreateProduct) {}

  @ApiBadRequestResponse({ description: 'Dados inválidos.', type: ApiErrorDto })
  @ApiCreatedResponse({ description: 'Produto criado.', type: ProductResponseDto })
  @ApiForbiddenResponse({
    description: 'Proteção CSRF ou origem inválida.',
    type: ApiErrorDto,
  })
  @ApiHeader({
    description: 'Deve ser enviado com o valor literal 1.',
    name: 'X-CSRF-Protection',
    required: true,
  })
  @ApiOperation({ summary: 'Cria um produto no catálogo compartilhado.' })
  @ApiUnauthorizedResponse({ description: 'Cookie inválido ou ausente.', type: ApiErrorDto })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(@Body() input: CreateProductDto): Promise<PublicProductData> {
    const product = await this.createProduct.execute(input);
    return product.toPublicData();
  }
}
