import { BadRequestException } from '@nestjs/common';
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
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { Attachment } from './entities/attachment.entity';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let repo: MockRepository;
  const tasksService = { exists: jest.fn() };
  const usersService = { exists: jest.fn() };

  const dto: CreateAttachmentDto = {
    fileName: 'a.png',
    fileUrl: 'https://cdn.example.com/a.png',
    mimeType: 'image/png',
    fileSize: 1000,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    repo.create.mockImplementation((e: object) => ({ ...e }));
    repo.save.mockImplementation((e: object) =>
      Promise.resolve({ ...e, id: 1 }),
    );
    repo.findOne.mockResolvedValue({ id: 1 });
    tasksService.exists.mockResolvedValue(true);
    usersService.exists.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(Attachment), useValue: repo },
        { provide: TasksService, useValue: tasksService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    service = moduleRef.get(AttachmentsService);
  });

  it('allows an anonymous upload (uploadedBy omitted) without a user lookup', async () => {
    await service.create(1, dto);
    expect(usersService.exists).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 1, uploadedBy: null }),
    );
  });

  it('throws 400 for an unknown uploader', async () => {
    usersService.exists.mockResolvedValue(false);
    await expect(service.create(1, { ...dto, uploadedBy: 5 })).rejects.toThrow(
      new BadRequestException('Uploader (user #5) does not exist'),
    );
  });

  it('maps chk_attachments_file_size to 400', async () => {
    repo.save.mockRejectedValue(
      pgError(PgErrorCode.CHECK_VIOLATION, 'chk_attachments_file_size'),
    );
    await expect(service.create(1, dto)).rejects.toThrow(
      'fileSize must be between 1 B and 10 MB',
    );
  });

  it('throws 404 when deleting from a missing task', async () => {
    repo.delete.mockResolvedValue({ affected: 0 });
    tasksService.exists.mockResolvedValue(false);
    await expect(service.remove(1, 2)).rejects.toThrow('Task #1 not found');
  });
});
