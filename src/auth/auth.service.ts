import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../task-management/users/dto/create-user.dto';
import { User } from '../task-management/users/entities/user.entity';
import { PasswordHasher } from '../task-management/users/password-hasher';
import { UsersService } from '../task-management/users/users.service';
import { AuthTokenService } from './auth-token.service';
import { AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, TokenType } from './jwt-payload.interface';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  /** Hash verified when the email is unknown, so timing doesn't leak which emails exist. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
  ) {}

  /** Creates a regular member account (role is never taken from input). */
  async register(
    dto: CreateUserDto,
  ): Promise<{ user: User; tokens: AuthTokensDto }> {
    const user = await this.usersService.create(dto);
    return { user, tokens: await this.tokens.issueTokens(user) };
  }

  async login(dto: LoginDto): Promise<{ user: User; tokens: AuthTokensDto }> {
    const user = await this.usersService.findByEmail(dto.email);
    const valid = await this.passwordHasher.verify(
      dto.password,
      user?.passwordHash ?? (await this.getDummyHash()),
    );
    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }
    return { user, tokens: await this.tokens.issueTokens(user) };
  }

  /** Exchanges a valid refresh token for a fresh token pair. */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const user = await this.authenticate(refreshToken, 'refresh');
    return this.tokens.issueTokens(user);
  }

  /**
   * Verifies a token and loads its user. Rejects tokens of deleted or
   * disabled users and tokens issued before the last password change.
   */
  async authenticate(token: string, type: TokenType): Promise<User> {
    const payload = await this.tokens.verify(token, type);
    return this.resolveUser(payload);
  }

  private async resolveUser(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (
      !user ||
      !user.isActive ||
      payload.pwv !== this.tokens.passwordFingerprint(user)
    ) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordHasher.hash('dummy-password-for-timing');
    return this.dummyHash;
  }
}
