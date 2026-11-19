import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import authConfig from '../config/auth.config';
import { UsersModule } from '../task-management/users/users.module';
import { AuthTokenService } from './auth-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * Authentication is on by default for every route (global guards below);
 * opt out with `@Public()`, restrict further with `@Roles(...)`.
 * Order matters: JwtAuthGuard sets `request.user` before RolesGuard reads it.
 */
@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    // Secrets/expiry are passed per call (separate access/refresh secrets).
    JwtModule.register({}),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
