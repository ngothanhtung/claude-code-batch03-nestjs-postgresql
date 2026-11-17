import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createMockRepository,
  MockRepository,
  pgError,
} from '../../../test/helpers/unit';
import { UserRole } from '../../database/enums';
import { PgErrorCode } from '../common/pg-error';
import { User } from './entities/user.entity';
import { PasswordHasher } from './password-hasher';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepository;
  const hasher = { hash: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo = createMockRepository();
    repo.create.mockImplementation((e: object) => ({ ...e }));
    repo.save.mockImplementation((e: object) => Promise.resolve(e));
    repo.existsBy.mockResolvedValue(false);
    hasher.hash.mockResolvedValue('hashed');

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: PasswordHasher, useValue: hasher },
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

  it('maps a unique email violation (race) to 409', async () => {
    repo.save.mockRejectedValue(pgError(PgErrorCode.UNIQUE_VIOLATION));
    await expect(
      service.create({ fullName: 'An', email: 'an@x.vn', password: 'x' }),
    ).rejects.toThrow(new ConflictException('Email already in use'));
  });

  it('updates role, isActive and avatarUrl', async () => {
    const user = { id: 1, email: 'a@x.vn', role: UserRole.MEMBER } as User;
    repo.findOneBy.mockResolvedValue(user);
    await service.update(1, {
      role: UserRole.ADMIN,
      isActive: false,
      avatarUrl: null,
    });
    expect(user).toMatchObject({
      role: UserRole.ADMIN,
      isActive: false,
      avatarUrl: null,
    });
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
