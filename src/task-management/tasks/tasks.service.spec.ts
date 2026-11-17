import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createMockRepository,
  MockRepository,
  pgError,
} from '../../../test/helpers/unit';
import { TaskPriority, TaskStatus } from '../../database/enums';
import { PgErrorCode } from '../common/pg-error';
import { Label } from '../labels/entities/label.entity';
import { LabelsService } from '../labels/labels.service';
import { ProjectMembersService } from '../project-members/project-members.service';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { Task } from './entities/task.entity';
import { TasksService } from './tasks.service';

const label = (id: number, name: string) =>
  ({ id, name, projectId: 1 }) as Label;

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 10,
    projectId: 1,
    parentId: null,
    title: 'Task',
    description: null,
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    assigneeId: null,
    createdBy: 1,
    dueDate: null,
    completedAt: null,
    position: 0,
    labels: [],
    ...overrides,
  }) as Task;

describe('TasksService', () => {
  let service: TasksService;
  let repo: MockRepository;
  const projectsService = { exists: jest.fn() };
  const usersService = { exists: jest.fn() };
  const membersService = { isOwnerOrMember: jest.fn() };
  const labelsService = { findManyInProject: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    repo.create.mockImplementation((e: object) => ({ ...e }));
    repo.save.mockImplementation((e: Task) =>
      Promise.resolve({ ...e, id: 10 }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: UsersService, useValue: usersService },
        { provide: ProjectMembersService, useValue: membersService },
        { provide: LabelsService, useValue: labelsService },
      ],
    }).compile();
    service = moduleRef.get(TasksService);

    projectsService.exists.mockResolvedValue(true);
    usersService.exists.mockResolvedValue(true);
    membersService.isOwnerOrMember.mockResolvedValue(true);
    labelsService.findManyInProject.mockResolvedValue([]);
  });

  describe('create', () => {
    const dto: CreateTaskDto = { projectId: 1, title: 'New', createdBy: 1 };

    beforeEach(() => {
      repo.findOne.mockImplementation(() => Promise.resolve(makeTask()));
    });

    it('rejects a missing project', async () => {
      projectsService.exists.mockResolvedValue(false);
      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException('Project #1 does not exist'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a missing creator', async () => {
      usersService.exists.mockResolvedValue(false);
      await expect(service.create(dto)).rejects.toThrow(
        'Creator (user #1) does not exist',
      );
    });

    it('rejects an assignee who is not in the project', async () => {
      membersService.isOwnerOrMember.mockResolvedValue(false);
      await expect(service.create({ ...dto, assigneeId: 7 })).rejects.toThrow(
        'User #7 is not a member of project #1',
      );
    });

    it('rejects a parent from another project', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 5, projectId: 2 });
      await expect(service.create({ ...dto, parentId: 5 })).rejects.toThrow(
        'Parent task must belong to the same project',
      );
    });

    it('sets completedAt only when created as done', async () => {
      await service.create({ ...dto, status: TaskStatus.DONE });
      expect(repo.save.mock.calls[0][0].completedAt).toBeInstanceOf(Date);

      repo.save.mockClear();
      await service.create(dto);
      expect(repo.save.mock.calls[0][0].completedAt).toBeNull();
      expect(repo.save.mock.calls[0][0].status).toBe(TaskStatus.TODO);
    });

    it('attaches labels resolved in the same project', async () => {
      const labels = [label(1, 'Bug')];
      labelsService.findManyInProject.mockResolvedValue(labels);
      await service.create({ ...dto, labelIds: [1] });
      expect(labelsService.findManyInProject).toHaveBeenCalledWith(1, [1]);
      expect(repo.save.mock.calls[0][0].labels).toBe(labels);
    });

    it('maps a FK violation (race) to a 400 with a clear message', async () => {
      repo.save.mockRejectedValue(
        pgError(PgErrorCode.FOREIGN_KEY_VIOLATION, 'tasks_created_by_fkey'),
      );
      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException('Creator does not exist'),
      );
    });
  });

  describe('update', () => {
    it('throws 404 for an unknown task', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.update(99, { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets completedAt when moving to done and clears it when leaving', async () => {
      const task = makeTask();
      repo.findOneBy.mockResolvedValue(task);
      repo.findOne.mockResolvedValue(task);

      await service.update(10, { status: TaskStatus.DONE });
      expect(task.completedAt).toBeInstanceOf(Date);

      await service.update(10, { status: TaskStatus.REVIEW });
      expect(task.completedAt).toBeNull();
    });

    it('keeps completedAt when status is unchanged', async () => {
      const completedAt = new Date('2026-01-01T00:00:00Z');
      const task = makeTask({ status: TaskStatus.DONE, completedAt });
      repo.findOneBy.mockResolvedValue(task);
      repo.findOne.mockResolvedValue(task);

      await service.update(10, { status: TaskStatus.DONE, title: 'Renamed' });
      expect(task.completedAt).toBe(completedAt);
      expect(task.title).toBe('Renamed');
    });

    it('rejects making a task its own parent', async () => {
      repo.findOneBy.mockResolvedValue(makeTask());
      repo.findOne.mockResolvedValue({ id: 10, projectId: 1 });
      await expect(service.update(10, { parentId: 10 })).rejects.toThrow(
        'A task cannot be its own parent',
      );
    });

    it('rejects a parent that is a descendant (cycle)', async () => {
      repo.findOneBy.mockResolvedValue(makeTask());
      repo.findOne.mockResolvedValue({ id: 11, projectId: 1 });
      repo.query.mockResolvedValue([{ '?column?': 1 }]);
      await expect(service.update(10, { parentId: 11 })).rejects.toThrow(
        'Parent task cannot be a sub-task of this task (cycle)',
      );
      expect(repo.query).toHaveBeenCalledWith(expect.any(String), [11, 10]);
    });

    it('allows clearing parent and assignee with null without lookups', async () => {
      const task = makeTask({ parentId: 3, assigneeId: 4 });
      repo.findOneBy.mockResolvedValue(task);
      repo.findOne.mockResolvedValue(task);

      await service.update(10, { parentId: null, assigneeId: null });
      expect(task.parentId).toBeNull();
      expect(task.assigneeId).toBeNull();
      expect(membersService.isOwnerOrMember).not.toHaveBeenCalled();
      expect(repo.query).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const query = Object.assign(new ListTasksQueryDto(), {
      page: 2,
      limit: 5,
    });

    it("paginates and sorts each task's labels by name", async () => {
      const task = makeTask({ labels: [label(2, 'UI'), label(1, 'Bug')] });
      repo.findAndCount.mockResolvedValue([[task], 6]);

      const result = await service.findAll({ ...query, projectId: 1 });

      expect(result.total).toBe(6);
      expect(task.labels!.map((l) => l.name)).toEqual(['Bug', 'UI']);
      const options = repo.findAndCount.mock.calls[0][0];
      expect(options).toMatchObject({ skip: 5, take: 5 });
      // Ordering by a labels column would break DISTINCT pagination.
      expect(options.order).toEqual({ position: 'ASC', id: 'ASC' });
    });

    it('rejects an inverted due date range', async () => {
      await expect(
        service.findAll({
          ...query,
          dueFrom: '2026-12-01',
          dueTo: '2026-11-01',
        }),
      ).rejects.toThrow('dueTo must not be before dueFrom');
    });
  });

  describe('remove', () => {
    it('throws 404 when nothing was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove(1)).rejects.toThrow('Task #1 not found');
    });
  });
});
