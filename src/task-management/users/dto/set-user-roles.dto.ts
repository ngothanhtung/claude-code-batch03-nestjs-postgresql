import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { RoleName } from '../../../database/enums';
import { ApiProperty } from '@nestjs/swagger';

export class SetUserRolesDto {
  @ApiProperty({
    enum: RoleName,
    enumName: 'RoleName',
    isArray: true,
    description:
      'Danh sách vai trò mới (thay thế toàn bộ). `Members` luôn được giữ dù có gửi hay không.',
    example: [RoleName.MANAGERS],
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(RoleName, { each: true })
  roles: RoleName[];
}
