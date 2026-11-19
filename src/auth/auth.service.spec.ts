import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import authConfig from '../config/auth.config';
import { RoleName } from '../database/enums';
import { User } from '../task-management/users/entities/user.entity';
import { PasswordHasher } from '../task-management/users/password-hasher';
import { UsersService } from '../task-management/users/users.service';
import { AuthTokenService } from './auth-token.service';
import { AuthService } from './auth.service';

const config = {
  issuer: 'test',
  accessSecret: 'a'.repeat(32),
  accessTtl: 900,
  refreshSecret: 'r'.repeat(32),
  refreshTtl: 3600,
};

describe('AuthService', () => {
  let service: AuthService;
  let tokens: AuthTokenService;
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const hasher = { hash: jest.fn(), verify: jest.fn() };
  let user: User;

  beforeEach(async () => {
    jest.resetAllMocks();
    user = {
      id: 7,
      email: 'an@x.vn',
      passwordHash: 'scrypt$salt$hash',
      roles: [{ id: 3, name: RoleName.MEMBERS }],
      isActive: true,
    } as unknown as User;
    hasher.hash.mockResolvedValue('scrypt$dummy$hash');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthTokenService,
        JwtService,
        { provide: authConfig.KEY, useValue: config },
        { provide: UsersService, useValue: users },
        { provide: PasswordHasher, useValue: hasher },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    tokens = moduleRef.get(AuthTokenService);
  });

  describe('login', () => {
    it('returns a token pair for valid credentials', async () => {
      users.findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);
      const { tokens: pair } = await service.login({
        email: user.email,
        password: 'pw',
      });
      expect(pair).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(pair.accessToken).not.toEqual(pair.refreshToken);
    });

    it('still verifies a hash when the email is unknown (timing-safe)', async () => {
      users.findByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(true);
      await expect(
        service.login({ email: 'no@x.vn', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(hasher.verify).toHaveBeenCalledWith('pw', 'scrypt$dummy$hash');
    });

    it('rejects a wrong password with 401', async () => {
      users.findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);
      await expect(
        service.login({ email: user.email, password: 'x' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects a disabled account with 403', async () => {
      users.findByEmail.mockResolvedValue({ ...user, isActive: false });
      hasher.verify.mockResolvedValue(true);
      await expect(
        service.login({ email: user.email, password: 'pw' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('authenticate', () => {
    it('resolves the user from a valid access token', async () => {
      const { accessToken } = await tokens.issueTokens(user);
      users.findById.mockResolvedValue(user);
      await expect(service.authenticate(accessToken, 'access')).resolves.toBe(
        user,
      );
    });

    it('rejects a refresh token used as an access token', async () => {
      const { refreshToken } = await tokens.issueTokens(user);
      users.findById.mockResolvedValue(user);
      await expect(
        service.authenticate(refreshToken, 'access'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it.each([
      ['the user was deleted', () => null],
      ['the user is disabled', (u: User) => ({ ...u, isActive: false })],
      [
        'the password changed',
        (u: User) => ({ ...u, passwordHash: 'scrypt$new$hash' }),
      ],
    ])('rejects the token when %s', async (_case, current) => {
      const { accessToken } = await tokens.issueTokens(user);
      users.findById.mockResolvedValue(current(user));
      await expect(service.authenticate(accessToken, 'access')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a tampered token', async () => {
      const { accessToken } = await tokens.issueTokens(user);
      await expect(
        service.authenticate(`${accessToken}x`, 'access'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
