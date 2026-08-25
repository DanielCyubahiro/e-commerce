import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import type { Page } from '@/shared/application';
import type { AuthenticatedUser } from '@/shared/presentation/authenticated-request';
import { CurrentUser } from '@/shared/presentation/decorators/current-user.decorator';
import { Roles } from '@/shared/presentation/decorators/roles.decorator';
import type { PaginatedResponse } from '@/shared/presentation/dtos/paginated-response.dto';
import { RolesGuard } from '@/shared/presentation/guards/roles.guard';
import {
  CancelOrderCommand,
  DeliverOrderCommand,
  GetOrderQuery,
  ListOrdersQuery,
  type OrderDetailReadModel,
  type OrderSummaryReadModel,
  PayOrderCommand,
  PlaceOrderCommand,
  ShipOrderCommand,
} from '../application';
import { IdempotencyKey } from './decorators/idempotency-key.decorator';
import { ListOrdersQueryDto } from './dtos/list-orders.query.dto';
import { OrderDetailResponseDto } from './dtos/order-detail.response.dto';
import { OrderIdParamDto } from './dtos/order-id.param.dto';
import { OrderSummaryResponseDto } from './dtos/order-summary.response.dto';
import { PlaceOrderDto } from './dtos/place-order.dto';
import { scopeOf } from './scope-of';

/**
 * Translates HTTP to a command or query and back; holds no logic of its own,
 * which is why it has no unit tests beyond the http-spec suite. Every route is
 * behind the global authentication guard; the three staff transitions add
 * `RolesGuard` at method level, which always runs after it.
 */
@Controller('orders')
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * `passthrough: true` is required: without it Nest hands over the raw
   * response and stops serialising the return value, so `return { id }` would
   * never send. A replayed `Idempotency-Key` answers exactly this, with the
   * first order's id.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async place(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PlaceOrderDto,
    @IdempotencyKey() idempotencyKey: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ id: string }> {
    const id = await this.commandBus.execute<PlaceOrderCommand, string>(
      new PlaceOrderCommand(
        user.userId,
        body.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        {
          recipientName: body.shippingAddress.recipientName,
          line1: body.shippingAddress.line1,
          line2: body.shippingAddress.line2,
          city: body.shippingAddress.city,
          region: body.shippingAddress.region,
          postalCode: body.shippingAddress.postalCode,
          country: body.shippingAddress.country,
        },
        idempotencyKey,
      ),
    );

    response.setHeader('Location', `/orders/${id}`);

    return { id };
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedResponse<OrderSummaryResponseDto>> {
    const page = await this.queryBus.execute<
      ListOrdersQuery,
      Page<OrderSummaryReadModel>
    >(
      new ListOrdersQuery(
        { status: query.status, customerId: query.customerId },
        scopeOf(user),
        { limit: query.limit, offset: query.offset },
      ),
    );

    return {
      items: page.items.map((item) =>
        OrderSummaryResponseDto.fromReadModel(item),
      ),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderIdParamDto,
  ): Promise<OrderDetailResponseDto> {
    const order = await this.queryBus.execute<
      GetOrderQuery,
      OrderDetailReadModel
    >(new GetOrderQuery(params.id, scopeOf(user)));

    return OrderDetailResponseDto.fromDetail(order);
  }

  /** Reach is decided by scope: a customer their own orders, staff any. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderIdParamDto,
  ): Promise<void> {
    await this.commandBus.execute<CancelOrderCommand, void>(
      new CancelOrderCommand(params.id, scopeOf(user)),
    );
  }

  @Post(':id/pay')
  @UseGuards(RolesGuard)
  @Roles('seller')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pay(@Param() params: OrderIdParamDto): Promise<void> {
    await this.commandBus.execute<PayOrderCommand, void>(
      new PayOrderCommand(params.id),
    );
  }

  @Post(':id/ship')
  @UseGuards(RolesGuard)
  @Roles('seller')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ship(@Param() params: OrderIdParamDto): Promise<void> {
    await this.commandBus.execute<ShipOrderCommand, void>(
      new ShipOrderCommand(params.id),
    );
  }

  @Post(':id/deliver')
  @UseGuards(RolesGuard)
  @Roles('seller')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deliver(@Param() params: OrderIdParamDto): Promise<void> {
    await this.commandBus.execute<DeliverOrderCommand, void>(
      new DeliverOrderCommand(params.id),
    );
  }
}
