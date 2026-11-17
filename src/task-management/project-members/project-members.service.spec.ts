import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createMockRepository,
  MockRepository,
  pgError,
} from '../../../test/helpers/unit';
import { PgErrorCode } from '../common/pg-error';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import {
  PROJECT_MEMBERS_PROJECT_FK,
  ProjectMember,
} from './entities/project-member.entity';
import { ProjectMembersService } from './project-members.service';

describe('ProjectMembersService', () => {
  let service: ProjectMembersService;
  let repo: MockRepository;
  const projectsService = { exists: jest.fn(), findOne: jest.fn() };
  const usersService = { exists: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    repo.create.mockImplementation((e: object) => ({ ...e }));
    projectsService.exists.mockResolvedValue(true);
    usersService.exists.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectMembersService,
        { provide: getRepositoryToken(ProjectMember), useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    service = moduleRef.get(ProjectMembersService);
  });

  describe('isOwnerOrMember', () => {
    it('treats the owner as a member without querying project_members', async () => {
      projectsService.findOne.mockResolvedValue({ id: 1, ownerId: 7 });
      await expect(service.isOwnerOrMember(1, 7)).resolves.toBe(true);
      expect(repo.existsBy).not.toHaveBeenCalled();
    });

    it('checks project_members for anyone else', async () => {
      projectsService.findOne.mockResolvedValue({ id: 1, ownerId: 7 });
      repo.existsBy.mockResolvedValue(false);
      await expect(service.isOwnerOrMember(1, 8)).resolves.toBe(false);
      expect(repo.existsBy).toHaveBeenCalledWith({ projectId: 1, userId: 8 });
    });
  });

  describe('add', () => {
    it('rejects a duplicate member with 409', async () => {
      repo.existsBy.mockResolvedValue(true);
      await expect(service.add(1, { userId: 2 })).rejects.toThrow(
        'User #2 is already a member of project #1',
      );
    });

    it('maps the project FK violation (project deleted meanwhile) to 404', async () => {
      repo.existsBy.mockResolvedValue(false);
      repo.save.mockRejectedValue(
        pgError(PgErrorCode.FOREIGN_KEY_VIOLATION, PROJECT_MEMBERS_PROJECT_FK),
      );
      await expect(service.add(1, { userId: 2 })).rejects.toThrow(
        'Project #1 not found',
      );
    });
  });
});
