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
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import {
  PaginatedProjectsResponseDto,
  ProjectResponseDto,
} from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('task-management/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async create(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return ProjectResponseDto.fromEntity(
      await this.projectsService.create(dto),
    );
  }

  @Get()
  async findAll(
    @Query() query: ListProjectsQueryDto,
  ): Promise<PaginatedProjectsResponseDto> {
    const { items, total } = await this.projectsService.findAll(query);
    return toPaginated(items, total, query, (project) =>
      ProjectResponseDto.fromEntity(project),
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProjectResponseDto> {
    return ProjectResponseDto.fromEntity(
      await this.projectsService.findOne(id),
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return ProjectResponseDto.fromEntity(
      await this.projectsService.update(id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.projectsService.remove(id);
  }
}
