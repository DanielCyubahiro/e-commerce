import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateProductDto } from './dtos/create-product.dto';
import { CreateProductCommand } from '../application/use-cases/create-product/create-product.command';

@Controller('products')
export class ProductController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async create(@Body() body: CreateProductDto): Promise<void> {
    await this.commandBus.execute(
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
}
