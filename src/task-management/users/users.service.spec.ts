import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createMockRepository,
  MockRepository,
  pgError,
} from '../../../test/helpers/unit';
import { RoleName } from '../../database/enums';
import { RolesService } from '../roles/roles.service';
import { PgErrorCode } from '../common/pg-error';
import { User } from './entities/user.entity';
import { PasswordHasher } from './password-hasher';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepository;
  const hasher = { hash: jest.fn() };
  const rolesService = { findByNames: jest.fn() };
  const role = (name: RoleName) => ({ id: name.length, name });

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    repo.create.mockImplementation((e: object) => ({ ...e }));
    repo.save.mockImplementation((e: object) => Promise.resolve(e));
    repo.existsBy.mockResolvedValue(false);
    hasher.hash.mockResolvedValue('hashed');
    rolesService.findByNames.mockImplementation((names: RoleName[]) =>
      Promise.resolve(names.map(role)),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: PasswordHasher, useValue: hasher },
        { provide: RolesService, useValue: rolesService },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('stores only the password hash', async () => {
    const user = await service.create({
      fullName: 'An',
      email: 'an@x.vn',
      password: 'secret123',
    });
    expect(user).toMatchObject({ passwordHash: 'hashed', avatarUrl: null });
    expect(user).not.toHaveProperty('password');
  });

  it('gives new accounts only the Members role', async () => {
    const user = await service.create({
      fullName: 'An',
      email: 'an@x.vn',
      password: 'secret123',
    });
    expect(user.roles).toEqual([role(RoleName.MEMBERS)]);
  });

  it('maps a unique email violation (race) to 409', async () => {
    repo.save.mockRejectedValue(pgError(PgErrorCode.UNIQUE_VIOLATION));
    await expect(
      service.create({ fullName: 'An', email: 'an@x.vn', password: 'x' }),
    ).rejects.toThrow(new ConflictException('Email already in use'));
  });

  it('updates isActive and avatarUrl', async () => {
    const user = { id: 1, email: 'a@x.vn', isActive: true, roles: [] };
    repo.findOne.mockResolvedValue(user);
    await service.update(1, { isActive: false, avatarUrl: null });
    expect(user).toMatchObject({ isActive: false, avatarUrl: null });
  });

  describe('setRoles', () => {
    const admin = () => ({
      id: 1,
      isActive: true,
      roles: [role(RoleName.ADMINISTRATORS), role(RoleName.MEMBERS)],
    });

    it('replaces the roles and always keeps Members', async () => {
      repo.findOne.mockResolvedValue({ id: 2, isActive: true, roles: [] });
      const user = await service.setRoles(2, { roles: [RoleName.MANAGERS] });
      expect(user.roles?.map((r) => r.name)).toEqual([
        RoleName.MANAGERS,
        RoleName.MEMBERS,
      ]);
    });

    it('refuses to demote the last active administrator', async () => {
      repo.findOne.mockResolvedValue(admin());
      repo.count.mockResolvedValue(1);
      await expect(service.setRoles(1, { roles: [] })).rejects.toThrow(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows demoting an admin when another active admin exists', async () => {
      repo.findOne.mockResolvedValue(admin());
      repo.count.mockResolvedValue(2);
      await expect(service.setRoles(1, { roles: [] })).resolves.toBeDefined();
    });
  });

  it.each([
    ['deactivated', (s: UsersService) => s.update(1, { isActive: false })],
    ['deleted', (s: UsersService) => s.remove(1)],
  ])('refuses to let the last active admin be %s', async (_case, act) => {
    repo.findOne.mockResolvedValue({
      id: 1,
      isActive: true,
      roles: [role(RoleName.ADMINISTRATORS)],
    });
    repo.count.mockResolvedValue(1);
    await expect(act(service)).rejects.toThrow(/last active administrator/);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['projects_owner_id_fkey', 'still owns projects'],
    ['tasks_created_by_fkey', 'has created tasks'],
  ])('explains a RESTRICT on %s when deleting', async (constraint, reason) => {
    repo.delete.mockRejectedValue(
      pgError(PgErrorCode.FOREIGN_KEY_VIOLATION, constraint),
    );
    await expect(service.remove(1)).rejects.toThrow(
      `User #1 ${reason} and cannot be deleted`,
    );
  });
});
