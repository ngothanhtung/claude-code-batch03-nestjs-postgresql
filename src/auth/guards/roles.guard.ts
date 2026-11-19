import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '../../database/enums';
import { AuthenticatedRequest } from '../authenticated-request';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Runs after JwtAuthGuard; allows the request when the user has at least one
 * of the roles required by `@Roles(...)` / `@CanCreate()` / `@CanModify()`.
 * Roles come from the DB (loaded by JwtAuthGuard), never from the token.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();
    const granted = new Set(user?.roles?.map((r) => r.name));
    if (!required.some((role) => granted.has(role))) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
