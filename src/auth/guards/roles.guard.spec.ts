import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '../../database/enums';
import { RolesGuard } from './roles.guard';

const contextFor = (...roles: RoleName[]) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles: roles.map((name) => ({ name })) } }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);
  const { ADMINISTRATORS, MANAGERS, MEMBERS } = RoleName;

  it('allows any authenticated user when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(MEMBERS))).toBe(true);
  });

  it('allows a user holding any one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([ADMINISTRATORS, MANAGERS]);
    expect(guard.canActivate(contextFor(MEMBERS, MANAGERS))).toBe(true);
  });

  it('rejects a user without any required role', () => {
    reflector.getAllAndOverride.mockReturnValue([ADMINISTRATORS]);
    expect(() => guard.canActivate(contextFor(MEMBERS, MANAGERS))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when no user is attached to the request', () => {
    reflector.getAllAndOverride.mockReturnValue([MEMBERS]);
    const ctx = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
