import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { toPaginated } from '../common/dto/paginated-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PaginatedUsersResponseDto,
  UserResponseDto,
} from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller('task-management/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.usersService.create(dto));
  }

  @Get()
  async findAll(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const { items, total } = await this.usersService.findAll(query);
    return toPaginated(items, total, query, (user) =>
      UserResponseDto.fromEntity(user),
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.usersService.findOne(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.usersService.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.usersService.remove(id);
  }
}
