import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { Label } from '../labels/entities/label.entity';
import { LabelsService } from '../labels/labels.service';
import { Task } from './entities/task.entity';

/** Manages the task_labels join table (task ↔ label, many-to-many). */
@Injectable()
export class TaskLabelsService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly labelsService: LabelsService,
  ) {}

  async findAll(taskId: number): Promise<Label[]> {
    const task = await this.getTask(taskId);
    const labels = await this.relation(task.id).loadMany<Label>();
    return labels.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Replaces the whole label set atomically. */
  async replace(taskId: number, labelIds: number[]): Promise<Label[]> {
    const task = await this.getTask(taskId);
    const labels = await this.labelsService.findManyInProject(
      task.projectId,
      labelIds,
    );
    await this.tasksRepository.manager.transaction(async (manager) => {
      const relation = manager
        .createQueryBuilder()
        .relation(Task, 'labels')
        .of(task.id);
      const current = await relation.loadMany<Label>();
      await relation.addAndRemove(labels, current);
    });
    return this.findAll(task.id);
  }

  async add(taskId: number, labelId: number): Promise<Label[]> {
    const task = await this.getTask(taskId);
    await this.labelsService.findManyInProject(task.projectId, [labelId]);
    try {
      await this.relation(task.id).add(labelId);
    } catch (error) {
      if (getPgError(error)?.code === PgErrorCode.UNIQUE_VIOLATION) {
        throw new ConflictException(
          `Label #${labelId} is already attached to task #${taskId}`,
        );
      }
      throw error;
    }
    return this.findAll(task.id);
  }

  async remove(taskId: number, labelId: number): Promise<void> {
    const task = await this.getTask(taskId);
    const attached = await this.relation(task.id).loadMany<Label>();
    if (!attached.some((label) => label.id === labelId)) {
      throw new NotFoundException(
        `Label #${labelId} is not attached to task #${taskId}`,
      );
    }
    await this.relation(task.id).remove(labelId);
  }

  private relation(taskId: number) {
    return this.tasksRepository
      .createQueryBuilder()
      .relation(Task, 'labels')
      .of(taskId);
  }

  private async getTask(taskId: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }
    return task;
  }
}
