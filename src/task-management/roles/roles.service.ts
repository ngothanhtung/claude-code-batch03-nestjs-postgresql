import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoleName } from '../../database/enums';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  findAll(): Promise<Role[]> {
    return this.rolesRepository.find({ order: { id: 'ASC' } });
  }

  /** Loads the given roles; throws if one is missing (migration not run). */
  async findByNames(names: RoleName[]): Promise<Role[]> {
    const unique = [...new Set(names)];
    const roles = await this.rolesRepository.findBy({ name: In(unique) });
    if (roles.length !== unique.length) {
      const found = new Set(roles.map((r) => r.name));
      const missing = unique.filter((n) => !found.has(n));
      throw new Error(`Roles missing from the database: ${missing.join(', ')}`);
    }
    return roles;
  }
}
