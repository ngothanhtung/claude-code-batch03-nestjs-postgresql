import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const contextFor = (request: object) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  const authService = { authenticate: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new JwtAuthGuard(
    authService as unknown as AuthService,
    reflector as unknown as Reflector,
  );

  beforeEach(() => jest.resetAllMocks());

  it('lets @Public() routes through without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it.each([
    ['no header', {}],
    ['a non-bearer scheme', { authorization: 'Basic abc' }],
    ['an empty bearer', { authorization: 'Bearer ' }],
  ])('rejects %s', async (_case, headers) => {
    await expect(guard.canActivate(contextFor({ headers }))).rejects.toThrow(
      new UnauthorizedException('Missing bearer token'),
    );
  });

  it('attaches the authenticated user to the request', async () => {
    const user = { id: 1 };
    authService.authenticate.mockResolvedValue(user);
    const request = { headers: { authorization: 'Bearer tok' } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(authService.authenticate).toHaveBeenCalledWith('tok', 'access');
    expect(request).toMatchObject({ user });
  });
});
