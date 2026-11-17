import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PasswordHasher } from './password-hasher';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    await this.ensureEmailAvailable(dto.email);

    const user = this.usersRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash: await this.passwordHasher.hash(dto.password),
      avatarUrl: dto.avatarUrl ?? null,
    });
    return this.saveHandlingConflicts(user);
  }

  async findAll(
    query: ListUsersQueryDto,
  ): Promise<{ items: User[]; total: number }> {
    const [items, total] = await this.usersRepository.findAndCount({
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items, total };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email: email.toLowerCase() });
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
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    return this.saveHandlingConflicts(user);
  }

  async remove(id: number): Promise<void> {
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
