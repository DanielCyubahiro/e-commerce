import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateProductDto } from './dtos/create-product.dto';
import { CreateProductCommand } from '../application/use-cases/commands/create-product/create-product.command';
import { ProductResponseDto } from './dtos/product-response.dto';
import { ListProductsQuery } from '../application/use-cases/queries/list-products/list-products.query';
import { GetProductQuery } from '../application/use-cases/queries/get-product/get-product.query';
import { Product } from '../domain/entities/product.entity';

@Controller('products')
export class ProductController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(@Body() body: CreateProductDto): Promise<void> {
    await this.commandBus.execute<CreateProductCommand, void>(
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
    @Query('isActive') isActive?: boolean,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ): Promise<ProductResponseDto[]> {
    const products = await this.queryBus.execute<ListProductsQuery, Product[]>(
      new ListProductsQuery(isActive, minPrice, maxPrice),
    );

    return products.map((product: Product) =>
      ProductResponseDto.fromDomain(product),
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    const product = await this.queryBus.execute<GetProductQuery, Product>(
      new GetProductQuery(id),
    );

    return ProductResponseDto.fromDomain(product);
  }
}
