import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CreateProductCommand,
  DeleteProductCommand,
  GetProductQuery,
  ListProductsQuery,
  type ProductReadModel,
} from '../application';
import type { Page } from '@/shared/application';
import { CreateProductDto } from './dtos/create-product.dto';
import { ProductResponseDto } from './dtos/product-response.dto';

@Controller('products')
export class ProductController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(@Body() body: CreateProductDto): Promise<void> {
    await this.commandBus.execute<CreateProductCommand, string>(
      new CreateProductCommand(
        body.name,
        body.description,
        body.price,
        body.sku,
        body.stock,
        body.currency || 'EUR',
      ),
    );
  }

  @Get()
  async findAll(
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('currency') currency?: string,
  ): Promise<ProductResponseDto[]> {
    const page = await this.queryBus.execute<
      ListProductsQuery,
      Page<ProductReadModel>
    >(
      new ListProductsQuery(
        { minPrice, maxPrice, currency },
        { limit: 100, offset: 0 },
      ),
    );

    return page.items.map((item) => ProductResponseDto.fromReadModel(item));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    const product = await this.queryBus.execute<
      GetProductQuery,
      ProductReadModel
    >(new GetProductQuery(id));

    return ProductResponseDto.fromReadModel(product);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute<DeleteProductCommand, void>(
      new DeleteProductCommand(id),
    );
  }
}
