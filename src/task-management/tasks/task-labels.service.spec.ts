import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createMockRelation,
  createMockRepository,
  MockRepository,
  pgError,
  queryBuilderFor,
} from '../../../test/helpers/unit';
import { PgErrorCode } from '../common/pg-error';
import { Label } from '../labels/entities/label.entity';
import { LabelsService } from '../labels/labels.service';
import { Task } from './entities/task.entity';
import { TaskLabelsService } from './task-labels.service';

const label = (id: number, name: string) =>
  ({ id, name, projectId: 1 }) as Label;

describe('TaskLabelsService', () => {
  let service: TaskLabelsService;
  let repo: MockRepository;
  let relation: ReturnType<typeof createMockRelation>;
  const labelsService = { findManyInProject: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    relation = createMockRelation();
    repo.createQueryBuilder.mockReturnValue(queryBuilderFor(relation));
    repo.findOne.mockResolvedValue({ id: 10, projectId: 1 });
    relation.loadMany.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskLabelsService,
        { provide: getRepositoryToken(Task), useValue: repo },
        { provide: LabelsService, useValue: labelsService },
      ],
    }).compile();
    service = moduleRef.get(TaskLabelsService);
  });

  it('throws 404 for an unknown task', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findAll(99)).rejects.toThrow(NotFoundException);
  });

  it('returns labels sorted by name', async () => {
    relation.loadMany.mockResolvedValue([label(2, 'UI'), label(1, 'Bug')]);
    const labels = await service.findAll(10);
    expect(labels.map((l) => l.name)).toEqual(['Bug', 'UI']);
  });

  it('validates the label belongs to the task project before adding', async () => {
    labelsService.findManyInProject.mockRejectedValue(
      new NotFoundException('Label(s) #4 not found in project #1'),
    );
    await expect(service.add(10, 4)).rejects.toThrow(NotFoundException);
    expect(labelsService.findManyInProject).toHaveBeenCalledWith(1, [4]);
    expect(relation.add).not.toHaveBeenCalled();
  });

  it('maps a duplicate attach (composite PK) to 409', async () => {
    labelsService.findManyInProject.mockResolvedValue([label(1, 'Bug')]);
    relation.add.mockRejectedValue(pgError(PgErrorCode.UNIQUE_VIOLATION));
    await expect(service.add(10, 1)).rejects.toThrow(ConflictException);
  });

  it('throws 404 when removing a label that is not attached', async () => {
    relation.loadMany.mockResolvedValue([label(2, 'UI')]);
    await expect(service.remove(10, 1)).rejects.toThrow(
      'Label #1 is not attached to task #10',
    );
    expect(relation.remove).not.toHaveBeenCalled();
  });

  it('replaces the label set inside a transaction', async () => {
    const current = [label(1, 'Bug')];
    const next = [label(2, 'UI')];
    labelsService.findManyInProject.mockResolvedValue(next);
    const txRelation = createMockRelation();
    txRelation.loadMany.mockResolvedValue(current);
    repo.manager.transaction.mockImplementation(
      (cb: (m: unknown) => Promise<void>) =>
        cb({ createQueryBuilder: () => queryBuilderFor(txRelation) }),
    );

    await service.replace(10, [2]);

    expect(repo.manager.transaction).toHaveBeenCalled();
    expect(txRelation.addAndRemove).toHaveBeenCalledWith(next, current);
  });
});
