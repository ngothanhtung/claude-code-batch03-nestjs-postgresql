import { applyDecorators, SetMetadata } from '@nestjs/common';
import { RoleName } from '../../database/enums';
import { ApiErrorResponses } from '../../task-management/common/decorators/api-error-responses.decorator';

export const ROLES_KEY = 'auth:roles';

/**
 * Restricts a handler/controller to users having at least one of the given
 * roles (authentication itself is global — see AuthModule). Prefer the policy
 * decorators below over listing roles by hand.
 */
export function Roles(...roles: RoleName[]) {
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiErrorResponses({
      403: `Không đủ quyền — chỉ dành cho: ${roles.map((r) => `\`${r}\``).join(', ')}.`,
    }),
  );
}

// --- RBAC policy (single place to change who may do what) --------------------
// Reads (GET) are open to every authenticated user, i.e. `Members`.

/** Creating resources: Administrators and Managers. */
export const CanCreate = () =>
  Roles(RoleName.ADMINISTRATORS, RoleName.MANAGERS);

/** Updating and deleting resources: Administrators only. */
export const CanModify = () => Roles(RoleName.ADMINISTRATORS);
