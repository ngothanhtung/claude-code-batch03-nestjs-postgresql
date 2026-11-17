import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createMockRepository,
  MockRepository,
  pgError,
} from '../../../test/helpers/unit';
import { PgErrorCode } from '../common/pg-error';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

describe('CommentsService', () => {
  let service: CommentsService;
  let repo: MockRepository;
  const tasksService = { exists: jest.fn() };
  const usersService = { exists: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    repo.create.mockImplementation((e: object) => ({ ...e }));
    tasksService.exists.mockResolvedValue(true);
    usersService.exists.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repo },
        { provide: TasksService, useValue: tasksService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    service = moduleRef.get(CommentsService);
  });

  const dto = { userId: 2, content: 'Hello' };

  it('throws 404 when the task does not exist', async () => {
    tasksService.exists.mockResolvedValue(false);
    await expect(service.create(1, dto)).rejects.toThrow(
      new NotFoundException('Task #1 not found'),
    );
  });

  it('throws 400 when the author does not exist', async () => {
    usersService.exists.mockResolvedValue(false);
    await expect(service.create(1, dto)).rejects.toThrow(
      new BadRequestException('User #2 does not exist'),
    );
  });

  it('maps chk_comments_content to 400', async () => {
    repo.save.mockRejectedValue(
      pgError(PgErrorCode.CHECK_VIOLATION, 'chk_comments_content'),
    );
    await expect(service.create(1, dto)).rejects.toThrow(
      'content must not be blank',
    );
  });

  it('maps a task FK violation (task deleted meanwhile) to 404', async () => {
    repo.save.mockRejectedValue(
      pgError(PgErrorCode.FOREIGN_KEY_VIOLATION, 'comments_task_id_fkey'),
    );
    await expect(service.create(1, dto)).rejects.toThrow(NotFoundException);
  });

  it('never selects password_hash for the author', async () => {
    repo.findAndCount.mockResolvedValue([[], 0]);
    await service.findAll(1, { page: 1, limit: 20 });
    const { select } = repo.findAndCount.mock.calls[0][0];
    expect(select.user).toEqual({ id: true, fullName: true, email: true });
  });

  it('scopes delete to the task and 404s when nothing matched', async () => {
    repo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.remove(1, 9)).rejects.toThrow(
      'Comment #9 not found on task #1',
    );
    expect(repo.delete).toHaveBeenCalledWith({ id: 9, taskId: 1 });
  });
});
