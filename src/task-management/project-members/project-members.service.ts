import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { USER_SUMMARY_COLUMNS } from '../common/dto/user-summary.dto';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ListProjectMembersQueryDto } from './dto/list-project-members-query.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import {
  PROJECT_MEMBERS_PROJECT_FK,
  ProjectMember,
} from './entities/project-member.entity';

/** Only expose safe user columns when joining (never password_hash). */
const USER_SUMMARY_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  memberRole: true,
  joinedAt: true,
  user: USER_SUMMARY_COLUMNS,
} as const;

@Injectable()
export class ProjectMembersService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly membersRepository: Repository<ProjectMember>,
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
  ) {}

  async add(
    projectId: number,
    dto: AddProjectMemberDto,
  ): Promise<ProjectMember> {
    await this.ensureProjectExists(projectId);
    if (!(await this.usersService.exists(dto.userId))) {
      throw new BadRequestException(`User #${dto.userId} does not exist`);
    }
    if (
      await this.membersRepository.existsBy({ projectId, userId: dto.userId })
    ) {
      throw this.alreadyMember(projectId, dto.userId);
    }

    const member = this.membersRepository.create({
      projectId,
      userId: dto.userId,
      memberRole: dto.memberRole,
    });
    try {
      await this.membersRepository.save(member);
    } catch (error) {
      throw this.mapConstraintError(error, projectId, dto.userId);
    }
    return this.findOne(projectId, dto.userId);
  }

  async findAll(
    projectId: number,
    query: ListProjectMembersQueryDto,
  ): Promise<{ items: ProjectMember[]; total: number }> {
    await this.ensureProjectExists(projectId);

    const where: FindOptionsWhere<ProjectMember> = { projectId };
    if (query.memberRole) where.memberRole = query.memberRole;

    // Single JOIN query — no N+1 when loading member users.
    const [items, total] = await this.membersRepository.findAndCount({
      where,
      relations: { user: true },
      select: USER_SUMMARY_SELECT,
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items, total };
  }

  async findOne(projectId: number, userId: number): Promise<ProjectMember> {
    const member = await this.membersRepository.findOne({
      where: { projectId, userId },
      relations: { user: true },
      select: USER_SUMMARY_SELECT,
    });
    if (!member) {
      await this.ensureProjectExists(projectId);
      throw new NotFoundException(
        `User #${userId} is not a member of project #${projectId}`,
      );
    }
    return member;
  }

  async update(
    projectId: number,
    userId: number,
    dto: UpdateProjectMemberDto,
  ): Promise<ProjectMember> {
    const member = await this.findOne(projectId, userId);
    await this.membersRepository.update(
      { id: member.id },
      { memberRole: dto.memberRole },
    );
    member.memberRole = dto.memberRole;
    return member;
  }

  async remove(projectId: number, userId: number): Promise<void> {
    const result = await this.membersRepository.delete({ projectId, userId });
    if (!result.affected) {
      await this.ensureProjectExists(projectId);
      throw new NotFoundException(
        `User #${userId} is not a member of project #${projectId}`,
      );
    }
  }

  /** True if the user is the project owner or listed in project_members. */
  async isOwnerOrMember(projectId: number, userId: number): Promise<boolean> {
    const project = await this.projectsService.findOne(projectId);
    if (project.ownerId === userId) return true;
    return this.membersRepository.existsBy({ projectId, userId });
  }

  private async ensureProjectExists(projectId: number): Promise<void> {
    if (!(await this.projectsService.exists(projectId))) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }
  }

  private alreadyMember(projectId: number, userId: number) {
    return new ConflictException(
      `User #${userId} is already a member of project #${projectId}`,
    );
  }

  /** DB constraints are the source of truth (covers concurrent requests). */
  private mapConstraintError(
    error: unknown,
    projectId: number,
    userId: number,
  ): unknown {
    const driverError = getPgError(error);
    if (driverError?.code === PgErrorCode.UNIQUE_VIOLATION) {
      return this.alreadyMember(projectId, userId);
    }
    if (driverError?.code === PgErrorCode.FOREIGN_KEY_VIOLATION) {
      return driverError.constraint === PROJECT_MEMBERS_PROJECT_FK
        ? new NotFoundException(`Project #${projectId} not found`)
        : new BadRequestException(`User #${userId} does not exist`);
    }
    return error;
  }
}
