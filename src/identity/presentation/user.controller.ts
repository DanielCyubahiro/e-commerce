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
  DeleteUserCommand,
  GetUserQuery,
  ListUsersQuery,
  type UserReadModel,
  RegisterUserCommand,
  UpdateUserCommand,
} from '../application';
import type { PaginatedResponse } from '@/shared/presentation/dtos/paginated-response.dto';
import { ListUsersQueryDto } from './dtos/list-users.query.dto';
import { RegisterUserDto } from './dtos/register-user.dto';
import { UpdateUserProfileDto } from './dtos/update-user-profile.dto';
import { UserIdParamDto } from './dtos/user-id.param.dto';
import { UserResponseDto } from './dtos/user-response.dto';

/**
 * Translates HTTP to a command or query and back; holds no logic of its own,
 * which is why it has no unit tests beyond the http-spec suite.
 */
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * `passthrough: true` is required: without it Nest hands over the raw
   * response and stops serialising the return value, so `return { id }` would
   * never send.
   *
   * This is registration: it stays public once a route guard lands elsewhere,
   * since nobody can hold a token before an account exists.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: RegisterUserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ id: string }> {
    const id = await this.commandBus.execute<RegisterUserCommand, string>(
      new RegisterUserCommand(
        {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          role: body.role,
          phone: body.phone,
        },
        body.password,
      ),
    );

    response.setHeader('Location', `/users/${id}`);

    return { id };
  }

  @Get()
  async findAll(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const page = await this.queryBus.execute<
      ListUsersQuery,
      Page<UserReadModel>
    >(
      new ListUsersQuery(
        { role: query.role },
        { limit: query.limit, offset: query.offset },
      ),
    );

    return {
      items: page.items.map((item) => UserResponseDto.fromReadModel(item)),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  @Get(':id')
  async findOne(@Param() params: UserIdParamDto): Promise<UserResponseDto> {
    const user = await this.queryBus.execute<GetUserQuery, UserReadModel>(
      new GetUserQuery(params.id),
    );

    return UserResponseDto.fromReadModel(user);
  }

  /**
   * Replaces every field; there is no merge with what is stored, so an omitted
   * `phone` clears it. Returns no body, so a client that needs the new
   * `updatedAt` re-reads the user.
   */
  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replace(
    @Param() params: UserIdParamDto,
    @Body() body: UpdateUserProfileDto,
  ): Promise<void> {
    await this.commandBus.execute<UpdateUserCommand, void>(
      new UpdateUserCommand(params.id, {
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        phone: body.phone,
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: UserIdParamDto): Promise<void> {
    await this.commandBus.execute<DeleteUserCommand, void>(
      new DeleteUserCommand(params.id),
    );
  }
}
