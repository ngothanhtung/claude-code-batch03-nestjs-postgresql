import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import authConfig from '../config/auth.config';
import { User } from '../task-management/users/entities/user.entity';
import { AuthTokensDto } from './dto/auth-response.dto';
import { JwtPayload, TokenType } from './jwt-payload.interface';

/** Signs and verifies access/refresh JWTs (stateless, separate secrets). */
@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async issueTokens(user: User): Promise<AuthTokensDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.sign(user, 'access'),
      this.sign(user, 'refresh'),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTtl,
    };
  }

  /** Verifies signature, expiry, issuer and token type. Throws 401 otherwise. */
  async verify(token: string, type: TokenType): Promise<JwtPayload> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.secretFor(type),
        issuer: this.config.issuer,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.typ !== type || !Number.isInteger(payload.sub)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return payload;
  }

  passwordFingerprint(user: User): string {
    return createHash('sha256')
      .update(user.passwordHash)
      .digest('base64url')
      .slice(0, 16);
  }

  private sign(user: User, typ: TokenType): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      typ,
      pwv: this.passwordFingerprint(user),
    };
    return this.jwtService.signAsync(payload, {
      secret: this.secretFor(typ),
      expiresIn:
        typ === 'access' ? this.config.accessTtl : this.config.refreshTtl,
      issuer: this.config.issuer,
      algorithm: 'HS256',
    });
  }

  private secretFor(type: TokenType): string {
    return type === 'access'
      ? this.config.accessSecret
      : this.config.refreshSecret;
  }
}
