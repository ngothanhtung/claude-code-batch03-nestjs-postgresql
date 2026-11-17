import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createMockRepository,
  MockRepository,
  pgError,
} from '../../../test/helpers/unit';
import { PgErrorCode } from '../common/pg-error';
import { ProjectsService } from '../projects/projects.service';
import { Label } from './entities/label.entity';
import { LabelsService } from './labels.service';

describe('LabelsService', () => {
  let service: LabelsService;
  let repo: MockRepository;
  const projectsService = { exists: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    repo.create.mockImplementation((e: object) => ({ ...e }));
    projectsService.exists.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        LabelsService,
        { provide: getRepositoryToken(Label), useValue: repo },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();
    service = moduleRef.get(LabelsService);
  });

  describe('create', () => {
    it('throws 404 when the project does not exist', async () => {
      projectsService.exists.mockResolvedValue(false);
      await expect(service.create(1, { name: 'Bug' })).rejects.toThrow(
        'Project #1 not found',
      );
    });

    it('leaves color undefined so the DB default applies', async () => {
      repo.save.mockImplementation((e: Label) => Promise.resolve(e));
      await service.create(1, { name: 'Bug' });
      expect(repo.create).toHaveBeenCalledWith({
        projectId: 1,
        name: 'Bug',
        color: undefined,
      });
    });

    it('maps the unique (project_id, name) violation to 409', async () => {
      repo.save.mockRejectedValue(
        pgError(PgErrorCode.UNIQUE_VIOLATION, 'uq_labels_project_name'),
      );
      await expect(service.create(1, { name: 'Bug' })).rejects.toThrow(
        new ConflictException('Label "Bug" already exists in project #1'),
      );
    });
  });

  describe('findOne', () => {
    it('reports the missing project rather than the label', async () => {
      repo.findOneBy.mockResolvedValue(null);
      projectsService.exists.mockResolvedValue(false);
      await expect(service.findOne(1, 5)).rejects.toThrow(
        'Project #1 not found',
      );
    });

    it('scopes the lookup to the project', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(2, 5)).rejects.toThrow(
        'Label #5 not found in project #2',
      );
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 5, projectId: 2 });
    });
  });

  describe('findManyInProject', () => {
    it('returns [] without querying for an empty list', async () => {
      await expect(service.findManyInProject(1, [])).resolves.toEqual([]);
      expect(repo.findBy).not.toHaveBeenCalled();
    });

    it('de-duplicates ids', async () => {
      repo.findBy.mockResolvedValue([{ id: 1 }]);
      await service.findManyInProject(1, [1, 1]);
      expect(repo.findBy).toHaveBeenCalledTimes(1);
    });

    it('lists every id missing from the project', async () => {
      repo.findBy.mockResolvedValue([{ id: 1 }]);
      await expect(service.findManyInProject(1, [1, 4, 7])).rejects.toThrow(
        new NotFoundException('Label(s) #4, #7 not found in project #1'),
      );
    });
  });
});
