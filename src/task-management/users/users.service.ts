import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { RoleName } from '../../database/enums';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PasswordHasher } from './password-hasher';

const WITH_ROLES = { roles: true } as const;

export function hasRole(user: User, role: RoleName): boolean {
  return user.roles?.some((r) => r.name === role) ?? false;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly passwordHasher: PasswordHasher,
    private readonly rolesService: RolesService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    await this.ensureEmailAvailable(dto.email);

    const user = this.usersRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash: await this.passwordHasher.hash(dto.password),
      avatarUrl: dto.avatarUrl ?? null,
      // New accounts always start as plain Members.
      roles: await this.rolesService.findByNames([RoleName.MEMBERS]),
    });
    return this.saveHandlingConflicts(user);
  }

  async findAll(
    query: ListUsersQueryDto,
  ): Promise<{ items: User[]; total: number }> {
    const [items, total] = await this.usersRepository.findAndCount({
      relations: WITH_ROLES,
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items, total };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: WITH_ROLES,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: WITH_ROLES,
    });
  }

  async exists(id: number): Promise<boolean> {
    return this.usersRepository.existsBy({ id });
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email !== undefined && dto.email !== user.email) {
      await this.ensureEmailAvailable(dto.email);
      user.email = dto.email;
    }
    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }
    if (dto.password !== undefined) {
      user.passwordHash = await this.passwordHasher.hash(dto.password);
    }
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.isActive === false && user.isActive) {
      await this.assertNotLastActiveAdmin(user, 'be deactivated');
    }
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    return this.saveHandlingConflicts(user);
  }

  /**
   * Replaces the user's roles. `Members` is always kept (baseline role), and
   * the last active administrator cannot lose `Administrators`.
   */
  async setRoles(id: number, dto: SetUserRolesDto): Promise<User> {
    const user = await this.findOne(id);
    const names = new Set([...dto.roles, RoleName.MEMBERS]);

    if (!names.has(RoleName.ADMINISTRATORS)) {
      await this.assertNotLastActiveAdmin(user, 'lose Administrators');
    }

    user.roles = await this.rolesService.findByNames([...names]);
    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    if (user) await this.assertNotLastActiveAdmin(user, 'be deleted');

    let result: DeleteResult;
    try {
      result = await this.usersRepository.delete({ id });
    } catch (error) {
      // projects.owner_id and tasks.created_by are ON DELETE RESTRICT
      const driverError = getPgError(error);
      if (driverError?.code === PgErrorCode.FOREIGN_KEY_VIOLATION) {
        const reason =
          driverError.constraint === 'tasks_created_by_fkey'
            ? 'has created tasks'
            : 'still owns projects';
        throw new ConflictException(
          `User #${id} ${reason} and cannot be deleted`,
        );
      }
      throw error;
    }
    if (!result.affected) {
      throw new NotFoundException(`User #${id} not found`);
    }
  }

  /** Keeps the system administrable: there must always be one active admin. */
  private async assertNotLastActiveAdmin(
    user: User,
    action: string,
  ): Promise<void> {
    if (!user.isActive || !hasRole(user, RoleName.ADMINISTRATORS)) return;
    const activeAdmins = await this.usersRepository.count({
      where: { isActive: true, roles: { name: RoleName.ADMINISTRATORS } },
    });
    if (activeAdmins <= 1) {
      throw new ConflictException(
        `User #${user.id} is the last active administrator and cannot ${action}`,
      );
    }
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const exists = await this.usersRepository.existsBy({ email });
    if (exists) {
      throw new ConflictException('Email already in use');
    }
  }

  /** The DB unique constraint is the source of truth (covers race conditions). */
  private async saveHandlingConflicts(user: User): Promise<User> {
    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (getPgError(error)?.code === PgErrorCode.UNIQUE_VIOLATION) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }
}
