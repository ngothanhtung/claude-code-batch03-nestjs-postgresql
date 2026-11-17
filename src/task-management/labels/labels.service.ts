import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { ProjectsService } from '../projects/projects.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { Label } from './entities/label.entity';

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Label)
    private readonly labelsRepository: Repository<Label>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(projectId: number, dto: CreateLabelDto): Promise<Label> {
    await this.ensureProjectExists(projectId);
    const label = this.labelsRepository.create({
      projectId,
      name: dto.name,
      color: dto.color, // undefined → DB default '#64748B'
    });
    return this.saveHandlingConstraints(label);
  }

  /** A project's label set is small, so it is returned unpaginated. */
  async findAll(projectId: number): Promise<Label[]> {
    await this.ensureProjectExists(projectId);
    return this.labelsRepository.find({
      where: { projectId },
      order: { name: 'ASC' },
    });
  }

  async findOne(projectId: number, labelId: number): Promise<Label> {
    const label = await this.labelsRepository.findOneBy({
      id: labelId,
      projectId,
    });
    if (!label) {
      await this.ensureProjectExists(projectId);
      throw new NotFoundException(
        `Label #${labelId} not found in project #${projectId}`,
      );
    }
    return label;
  }

  async update(
    projectId: number,
    labelId: number,
    dto: UpdateLabelDto,
  ): Promise<Label> {
    const label = await this.findOne(projectId, labelId);
    if (dto.name !== undefined) label.name = dto.name;
    if (dto.color !== undefined) label.color = dto.color;
    return this.saveHandlingConstraints(label);
  }

  /** Also detaches the label from every task (task_labels ON DELETE CASCADE). */
  async remove(projectId: number, labelId: number): Promise<void> {
    const result = await this.labelsRepository.delete({
      id: labelId,
      projectId,
    });
    if (!result.affected) {
      await this.ensureProjectExists(projectId);
      throw new NotFoundException(
        `Label #${labelId} not found in project #${projectId}`,
      );
    }
  }

  /**
   * Resolves label ids for a task, ensuring every label belongs to the task's
   * project (labels are per-project; cross-project tagging is not allowed).
   */
  async findManyInProject(projectId: number, ids: number[]): Promise<Label[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const labels = await this.labelsRepository.findBy({
      id: In(uniqueIds),
      projectId,
    });
    if (labels.length !== uniqueIds.length) {
      const found = new Set(labels.map((l) => l.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Label(s) ${missing.map((id) => `#${id}`).join(', ')} not found in project #${projectId}`,
      );
    }
    return labels;
  }

  private async ensureProjectExists(projectId: number): Promise<void> {
    if (!(await this.projectsService.exists(projectId))) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }
  }

  /** DB constraints are the source of truth (covers concurrent requests). */
  private async saveHandlingConstraints(label: Label): Promise<Label> {
    try {
      return await this.labelsRepository.save(label);
    } catch (error) {
      const pg = getPgError(error);
      if (pg?.code === PgErrorCode.UNIQUE_VIOLATION) {
        throw new ConflictException(
          `Label "${label.name}" already exists in project #${label.projectId}`,
        );
      }
      if (pg?.code === PgErrorCode.FOREIGN_KEY_VIOLATION) {
        throw new NotFoundException(`Project #${label.projectId} not found`);
      }
      throw error;
    }
  }
}
