import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import type { Page } from '@/shared/application';
import {
  CreateProductCommand,
  DeleteProductCommand,
  GetProductQuery,
  ListProductsQuery,
  type ProductReadModel,
  UpdateProductCommand,
} from '../application';
import { CreateProductDto } from './dtos/create-product.dto';
import { ListProductsQueryDto } from './dtos/list-products.query.dto';
import type { PaginatedResponse } from './dtos/paginated-response.dto';
import { ProductIdParamDto } from './dtos/product-id.param.dto';
import { ProductResponseDto } from './dtos/product-response.dto';
import { UpdateProductDto } from './dtos/update-product.dto';

/**
 * Translates HTTP to a command or query and back; holds no logic of its own,
 * which is why it has no unit tests beyond the http-spec suite.
 */
@Controller('products')
export class ProductController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Returns the id and sets `Location`, so a client need not parse the body to
   * find the new resource.
   *
   * `passthrough: true` is required: without it Nest hands over the raw
   * response and stops serialising the return value, so `return { id }` would
   * never send.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateProductDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ id: string }> {
    const id = await this.commandBus.execute<CreateProductCommand, string>(
      new CreateProductCommand(
        body.name,
        body.description,
        body.price,
        body.sku,
        body.stock,
        body.currency,
      ),
    );

    response.setHeader('Location', `/products/${id}`);

    return { id };
  }

  @Get()
  async findAll(
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    const page = await this.queryBus.execute<
      ListProductsQuery,
      Page<ProductReadModel>
    >(
      new ListProductsQuery(
        {
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          currency: query.currency,
        },
        { limit: query.limit, offset: query.offset },
      ),
    );

    return {
      items: page.items.map((item) => ProductResponseDto.fromReadModel(item)),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  @Get(':id')
  async findOne(
    @Param() params: ProductIdParamDto,
  ): Promise<ProductResponseDto> {
    const product = await this.queryBus.execute<
      GetProductQuery,
      ProductReadModel
    >(new GetProductQuery(params.id));

    return ProductResponseDto.fromReadModel(product);
  }

  /**
   * Replaces every field; there is no merge with what is stored, which is why
   * the body carries all six. Returns no body, so a client that needs the new
   * `updatedAt` re-reads the product.
   */
  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replace(
    @Param() params: ProductIdParamDto,
    @Body() body: UpdateProductDto,
  ): Promise<void> {
    await this.commandBus.execute<UpdateProductCommand, void>(
      new UpdateProductCommand(params.id, {
        name: body.name,
        description: body.description,
        price: body.price,
        currency: body.currency,
        sku: body.sku,
        stock: body.stock,
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: ProductIdParamDto): Promise<void> {
    await this.commandBus.execute<DeleteProductCommand, void>(
      new DeleteProductCommand(params.id),
    );
  }
}
