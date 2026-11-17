import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { TaskStatus } from '../../database/enums';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { LabelsService } from '../labels/labels.service';
import { ProjectMembersService } from '../project-members/project-members.service';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { AssignedTasksQueryDto } from './dto/assigned-tasks-query.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { DueSoonTasksQueryDto } from './dto/due-soon-tasks-query.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';

/** Maps FK constraint names (docs/database.md §7) to client-facing messages. */
const FK_MESSAGES: Record<string, string> = {
  tasks_project_id_fkey: 'Project does not exist',
  tasks_parent_id_fkey: 'Parent task does not exist',
  tasks_assignee_id_fkey: 'Assignee does not exist',
  tasks_created_by_fkey: 'Creator does not exist',
};

/** Stable label order in responses (sorted in memory, see findAll). */
function sortLabels(task: Task): Task {
  task.labels?.sort((a, b) => a.name.localeCompare(b.name));
  return task;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local calendar date as `YYYY-MM-DD` (same form as the `due_date` column). */
function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return toDateOnly(new Date(y, m - 1, d + days));
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`), DST-safe via UTC. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

export interface DueSoonTask {
  task: Task;
  daysRemaining: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly membersService: ProjectMembersService,
    private readonly labelsService: LabelsService,
  ) {}

  async create(dto: CreateTaskDto): Promise<Task> {
    if (!(await this.projectsService.exists(dto.projectId))) {
      throw new BadRequestException(`Project #${dto.projectId} does not exist`);
    }
    if (!(await this.usersService.exists(dto.createdBy))) {
      throw new BadRequestException(
        `Creator (user #${dto.createdBy}) does not exist`,
      );
    }
    if (dto.parentId != null) {
      await this.ensureValidParent(dto.projectId, dto.parentId);
    }
    if (dto.assigneeId != null) {
      await this.ensureAssignable(dto.projectId, dto.assigneeId);
    }
    const labels = await this.labelsService.findManyInProject(
      dto.projectId,
      dto.labelIds ?? [],
    );

    const status = dto.status ?? TaskStatus.TODO;
    const task = this.tasksRepository.create({
      projectId: dto.projectId,
      parentId: dto.parentId ?? null,
      title: dto.title,
      description: dto.description ?? null,
      status,
      priority: dto.priority,
      assigneeId: dto.assigneeId ?? null,
      createdBy: dto.createdBy,
      dueDate: dto.dueDate ?? null,
      completedAt: status === TaskStatus.DONE ? new Date() : null,
      position: dto.position,
      labels,
    });
    // save() wraps the task insert and task_labels inserts in one transaction.
    const saved = await this.saveHandlingConstraints(task);
    return this.findOne(saved.id);
  }

  async findAll(
    query: ListTasksQueryDto,
  ): Promise<{ items: Task[]; total: number }> {
    const where: FindOptionsWhere<Task> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.parentId) where.parentId = query.parentId;
    if (query.dueFrom && query.dueTo) {
      if (query.dueTo < query.dueFrom) {
        throw new BadRequestException('dueTo must not be before dueFrom');
      }
      where.dueDate = Between(query.dueFrom, query.dueTo);
    } else if (query.dueFrom) {
      where.dueDate = MoreThanOrEqual(query.dueFrom);
    } else if (query.dueTo) {
      where.dueDate = LessThanOrEqual(query.dueTo);
    }

    // Labels are loaded with the page in a fixed number of queries (no N+1).
    // Do NOT order by a labels column here: with skip/take TypeORM's DISTINCT
    // id subquery then returns one row per label, breaking page and total.
    const [items, total] = await this.tasksRepository.findAndCount({
      where,
      relations: { labels: true },
      order: { position: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    items.forEach(sortLabels);
    return { items, total };
  }

  /**
   * Unfinished tasks of a project due within `[today, today + days]`,
   * most urgent first. "Today" is the server's local date. Served by
   * idx_tasks_project_status / idx_tasks_due_date.
   */
  async findDueSoon(
    projectId: number,
    query: DueSoonTasksQueryDto,
  ): Promise<{ items: DueSoonTask[]; total: number }> {
    if (!(await this.projectsService.exists(projectId))) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    const today = toDateOnly(new Date());
    const until = addDays(today, query.days);

    // Same no-N+1 / no-label-ordering constraints as findAll.
    const [tasks, total] = await this.tasksRepository.findAndCount({
      where: {
        projectId,
        status: Not(TaskStatus.DONE),
        dueDate: Between(today, until),
      },
      relations: { labels: true },
      order: { dueDate: 'ASC', priority: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const items = tasks.map((task) => ({
      task: sortLabels(task),
      // dueDate is non-null here: it is constrained by Between above.
      daysRemaining: daysBetween(today, task.dueDate!),
    }));
    return { items, total };
  }

  /**
   * Tasks assigned to a user across all projects ("my tasks"), each with its
   * project loaded. Unfinished by default; tasks with the nearest due date
   * first, undated ones last. Served by idx_tasks_assignee.
   */
  async findAssigned(
    userId: number,
    query: AssignedTasksQueryDto,
  ): Promise<{ items: Task[]; total: number }> {
    if (!(await this.usersService.exists(userId))) {
      throw new NotFoundException(`User #${userId} not found`);
    }

    const where: FindOptionsWhere<Task> = { assigneeId: userId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.priority) where.priority = query.priority;
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeDone) {
      where.status = Not(TaskStatus.DONE);
    }

    // Same no-N+1 / no-label-ordering constraints as findAll.
    const [items, total] = await this.tasksRepository.findAndCount({
      where,
      relations: { labels: true, project: true },
      order: {
        dueDate: { direction: 'ASC', nulls: 'LAST' },
        priority: 'DESC',
        id: 'ASC',
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    items.forEach(sortLabels);
    return { items, total };
  }

  async findOne(id: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: { labels: true },
    });
    if (!task) {
      throw new NotFoundException(`Task #${id} not found`);
    }
    return sortLabels(task);
  }

  async exists(id: number): Promise<boolean> {
    return this.tasksRepository.existsBy({ id });
  }

  async update(id: number, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.tasksRepository.findOneBy({ id });
    if (!task) {
      throw new NotFoundException(`Task #${id} not found`);
    }

    if (dto.parentId !== undefined && dto.parentId !== task.parentId) {
      if (dto.parentId !== null) {
        await this.ensureValidParent(task.projectId, dto.parentId, task.id);
      }
      task.parentId = dto.parentId;
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      if (dto.assigneeId !== null) {
        await this.ensureAssignable(task.projectId, dto.assigneeId);
      }
      task.assigneeId = dto.assigneeId;
    }
    if (dto.status !== undefined && dto.status !== task.status) {
      task.status = dto.status;
      // Keeps chk_tasks_completed satisfied: only 'done' tasks have completed_at.
      task.completedAt = dto.status === TaskStatus.DONE ? new Date() : null;
    }
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate;
    if (dto.position !== undefined) task.position = dto.position;

    await this.saveHandlingConstraints(task);
    return this.findOne(id);
  }

  /** Sub-tasks, comments, attachments and task_labels are removed by CASCADE. */
  async remove(id: number): Promise<void> {
    const result = await this.tasksRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Task #${id} not found`);
    }
  }

  private async ensureAssignable(
    projectId: number,
    userId: number,
  ): Promise<void> {
    if (!(await this.usersService.exists(userId))) {
      throw new BadRequestException(
        `Assignee (user #${userId}) does not exist`,
      );
    }
    if (!(await this.membersService.isOwnerOrMember(projectId, userId))) {
      throw new BadRequestException(
        `User #${userId} is not a member of project #${projectId}`,
      );
    }
  }

  /**
   * The parent must exist in the same project and must not be the task itself
   * or one of its descendants (that would create a cycle).
   */
  private async ensureValidParent(
    projectId: number,
    parentId: number,
    taskId?: number,
  ): Promise<void> {
    const parent = await this.tasksRepository.findOne({
      where: { id: parentId },
      select: { id: true, projectId: true },
    });
    if (!parent) {
      throw new BadRequestException(`Parent task #${parentId} does not exist`);
    }
    if (parent.projectId !== projectId) {
      throw new BadRequestException(
        'Parent task must belong to the same project',
      );
    }
    if (taskId === undefined) return;
    if (parentId === taskId) {
      throw new BadRequestException('A task cannot be its own parent');
    }

    // Walk up from the new parent; reaching taskId means it is a descendant.
    const rows: unknown[] = await this.tasksRepository.query(
      `WITH RECURSIVE ancestors AS (
         SELECT id, parent_id FROM tasks WHERE id = $1
         UNION ALL
         SELECT t.id, t.parent_id FROM tasks t
         JOIN ancestors a ON t.id = a.parent_id
       )
       SELECT 1 FROM ancestors WHERE id = $2 LIMIT 1`,
      [parentId, taskId],
    );
    if (rows.length > 0) {
      throw new BadRequestException(
        'Parent task cannot be a sub-task of this task (cycle)',
      );
    }
  }

  /** DB constraints are the source of truth (covers concurrent changes). */
  private async saveHandlingConstraints(task: Task): Promise<Task> {
    try {
      return await this.tasksRepository.save(task);
    } catch (error) {
      const pg = getPgError(error);
      if (pg?.code === PgErrorCode.FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException(
          FK_MESSAGES[pg.constraint ?? ''] ??
            'Referenced record does not exist',
        );
      }
      if (pg?.code === PgErrorCode.CHECK_VIOLATION) {
        throw new BadRequestException(`Task violates ${pg.constraint}`);
      }
      throw error;
    }
  }
}
