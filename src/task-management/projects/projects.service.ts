import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { UsersService } from '../users/users.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    this.ensureValidDateRange(dto.startDate, dto.endDate);
    await this.ensureOwnerExists(dto.ownerId);

    const project = this.projectsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      ownerId: dto.ownerId,
      status: dto.status,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
    });
    return this.saveHandlingConstraints(project);
  }

  async findAll(
    query: ListProjectsQueryDto,
  ): Promise<{ items: Project[]; total: number }> {
    const where: FindOptionsWhere<Project> = {};
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;

    const [items, total] = await this.projectsRepository.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items, total };
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.projectsRepository.findOneBy({ id });
    if (!project) {
      throw new NotFoundException(`Project #${id} not found`);
    }
    return project;
  }

  async exists(id: number): Promise<boolean> {
    return this.projectsRepository.existsBy({ id });
  }

  async update(id: number, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);

    // Validate against the merged result so a partial update can't break the range.
    const startDate =
      dto.startDate !== undefined ? dto.startDate : project.startDate;
    const endDate = dto.endDate !== undefined ? dto.endDate : project.endDate;
    this.ensureValidDateRange(startDate, endDate);

    if (dto.ownerId !== undefined && dto.ownerId !== project.ownerId) {
      await this.ensureOwnerExists(dto.ownerId);
      project.ownerId = dto.ownerId;
    }
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status !== undefined) project.status = dto.status;
    project.startDate = startDate;
    project.endDate = endDate;

    return this.saveHandlingConstraints(project);
  }

  async remove(id: number): Promise<void> {
    const result = await this.projectsRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Project #${id} not found`);
    }
  }

  private ensureValidDateRange(
    startDate: string | null | undefined,
    endDate: string | null | undefined,
  ): void {
    // 'YYYY-MM-DD' strings compare correctly lexicographically.
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate');
    }
  }

  private async ensureOwnerExists(ownerId: number): Promise<void> {
    if (!(await this.usersService.exists(ownerId))) {
      throw new BadRequestException(`Owner (user #${ownerId}) does not exist`);
    }
  }

  /** DB constraints are the source of truth (covers races, e.g. owner deleted meanwhile). */
  private async saveHandlingConstraints(project: Project): Promise<Project> {
    try {
      return await this.projectsRepository.save(project);
    } catch (error) {
      const code = getPgError(error)?.code;
      if (code === PgErrorCode.FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException(
          `Owner (user #${project.ownerId}) does not exist`,
        );
      }
      if (code === PgErrorCode.CHECK_VIOLATION) {
        throw new BadRequestException('endDate must not be before startDate');
      }
      throw error;
    }
  }
}
