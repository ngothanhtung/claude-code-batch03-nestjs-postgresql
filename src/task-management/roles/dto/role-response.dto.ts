import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '../../../database/enums';
import { Role } from '../entities/role.entity';

export class RoleResponseDto {
  /** @example 1 */
  id: number;

  @ApiProperty({ enum: RoleName, enumName: 'RoleName' })
  name: RoleName;

  static fromEntity(role: Role): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = role.id;
    dto.name = role.name;
    return dto;
  }
}
