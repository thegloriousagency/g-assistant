import { Logger, Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { EmailModule } from '../email/email.module';

const DEFAULT_JWT_EXPIRES_IN: JwtSignOptions['expiresIn'] = '1h';
const MIN_JWT_EXPIRY_SECONDS = 60;

function resolveJwtExpiresIn(
  rawValue: string | undefined | null,
  logger: Logger,
): JwtSignOptions['expiresIn'] {
  if (!rawValue) {
    logger.log(
      `JWT_EXPIRES_IN is not set. Falling back to default (${DEFAULT_JWT_EXPIRES_IN}).`,
    );
    return DEFAULT_JWT_EXPIRES_IN;
  }

  const trimmed = rawValue.trim();
  if (!trimmed.length) {
    logger.log(
      `JWT_EXPIRES_IN is empty. Falling back to default (${DEFAULT_JWT_EXPIRES_IN}).`,
    );
    return DEFAULT_JWT_EXPIRES_IN;
  }

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue)) {
    if (numericValue < MIN_JWT_EXPIRY_SECONDS) {
      logger.warn(
        `JWT_EXPIRES_IN is set to ${numericValue} seconds, which is below the minimum of ${MIN_JWT_EXPIRY_SECONDS}. Using default (${DEFAULT_JWT_EXPIRES_IN}).`,
      );
      return DEFAULT_JWT_EXPIRES_IN;
    }
    return numericValue;
  }

  return trimmed;
}

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    EmailModule,
    TenantsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('AuthModule');
        const expiresIn = resolveJwtExpiresIn(
          config.get<string>('JWT_EXPIRES_IN'),
          logger,
        );
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, AdminGuard],
})
export class AuthModule {}
