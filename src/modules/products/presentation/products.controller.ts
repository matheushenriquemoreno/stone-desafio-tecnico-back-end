import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../../../shared/presentation/errors/api-error.dto';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard';
import { CreateProduct } from '../application/create-product/create-product';
import { GetProduct } from '../application/get-product/get-product';
import { ListProducts } from '../application/list-products/list-products';
import type { ProductPage } from '../application/ports/product-repository';
import type { PublicProductData } from '../domain/product';
import { CreateProductDto } from './create-product.dto';
import { ListProductsQueryDto } from './list-products.query.dto';
import { ProductResponseDto } from './product.response.dto';
import {
  ProductsPageResponseDto,
  type PublicProductsPage,
} from './products-page.response.dto';

@ApiCookieAuth()
@ApiTags('products')
@Controller('products')
@UseGuards(AccessTokenGuard)
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProduct,
    private readonly getProduct: GetProduct,
    private readonly listProducts: ListProducts,
  ) {}

  @ApiBadRequestResponse({ description: 'Query inválida.', type: ApiErrorDto })
  @ApiOkResponse({ description: 'Página de produtos.', type: ProductsPageResponseDto })
  @ApiOperation({ summary: 'Lista produtos por cursor.' })
  @ApiQuery({
    description: 'Quantidade de itens; padrão 20, entre 1 e 100.',
    maximum: 100,
    minimum: 1,
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Cursor opaco retornado pela página anterior.',
    name: 'cursor',
    required: false,
    type: String,
  })
  @ApiUnauthorizedResponse({ description: 'Cookie inválido ou ausente.', type: ApiErrorDto })
  @Get()
  async list(@Query() query: ListProductsQueryDto): Promise<PublicProductsPage> {
    const page = await this.listProducts.execute(query);
    return this.toPublicPage(page);
  }

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

  @ApiNotFoundResponse({ description: 'Produto não encontrado.', type: ApiErrorDto })
  @ApiOkResponse({ description: 'Produto encontrado.', type: ProductResponseDto })
  @ApiOperation({ summary: 'Consulta um produto pelo identificador.' })
  @ApiUnauthorizedResponse({ description: 'Cookie inválido ou ausente.', type: ApiErrorDto })
  @Get(':id')
  async get(@Param('id') id: string): Promise<PublicProductData> {
    const product = await this.getProduct.execute(id);
    return product.toPublicData();
  }

  private toPublicPage(page: ProductPage): PublicProductsPage {
    return {
      items: page.items.map((product) => product.toPublicData()),
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    };
  }
}
