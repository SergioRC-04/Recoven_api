import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Verify2FADto } from './dto/verify.dto';
import { Resend2FADto } from './dto/resend.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verify2FA(@Body() Verify2FADto: Verify2FADto) {
    return await this.authService.verify2FA(
      Verify2FADto.username,
      Verify2FADto.code,
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-2fa')
  @HttpCode(HttpStatus.OK)
  async resend2fa(@Body() Resend2FADto: Resend2FADto) {
    return await this.authService.sendTwoFactorCode(Resend2FADto.username);
  }

  // El JWT es sin estado (no hay tabla de sesiones ni blacklist de
  // tokens) — no hay nada que invalidar del lado del servidor. Este
  // endpoint existe solo para que el frontend tenga a dónde llamar sin
  // que le explote con un 404 (como pasaba antes): el logout real ocurre
  // en el navegador, borrando el token guardado localmente.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return { success: true };
  }
}
