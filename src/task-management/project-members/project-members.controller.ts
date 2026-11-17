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
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ListProjectMembersQueryDto } from './dto/list-project-members-query.dto';
import {
  PaginatedProjectMembersResponseDto,
  ProjectMemberResponseDto,
} from './dto/project-member-response.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { ProjectMembersService } from './project-members.service';

@Controller('task-management/projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Post()
  async add(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    return ProjectMemberResponseDto.fromEntity(
      await this.membersService.add(projectId, dto),
    );
  }

  @Get()
  async findAll(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListProjectMembersQueryDto,
  ): Promise<PaginatedProjectMembersResponseDto> {
    const { items, total } = await this.membersService.findAll(
      projectId,
      query,
    );
    return toPaginated(items, total, query, (member) =>
      ProjectMemberResponseDto.fromEntity(member),
    );
  }

  @Get(':userId')
  async findOne(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ProjectMemberResponseDto> {
    return ProjectMemberResponseDto.fromEntity(
      await this.membersService.findOne(projectId, userId),
    );
  }

  @Patch(':userId')
  async update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    return ProjectMemberResponseDto.fromEntity(
      await this.membersService.update(projectId, userId, dto),
    );
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    await this.membersService.remove(projectId, userId);
  }
}
