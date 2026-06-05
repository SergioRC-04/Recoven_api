import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verify2FA(@Body() body: { username: string; code: string }) {
    return await this.authService.verify2FA(body.username, body.code);
  }
}
