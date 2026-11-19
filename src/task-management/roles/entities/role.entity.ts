import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { RoleName } from '../../../database/enums';

/** Fixed system roles; rows are created by the AddRbacRoles migration. */
@Entity({ name: 'roles' })
@Unique('roles_name_key', ['name'])
export class Role {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'roles_pkey',
  })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: RoleName;
}
