import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(dto: LoginDto) {
    const { username, password } = dto;

    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin) throw new UnauthorizedException('Credenciales incorrectas');

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciales incorrectas');

    // Generar y enviar código 2FA
    await this.generateAndSend2FACode(admin.id, admin.email);

    return {
      requires2FA: true,
      message: 'Código de verificación enviado al correo registrado.',
    };
  }

  async verify2FA(username: string, code: string) {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin || !admin.twoFactorCode) {
      throw new UnauthorizedException('Petición inválida');
    }

    if (new Date() > admin.twoFactorExpires!) {
      throw new BadRequestException(
        'El código ha expirado. Solicita uno nuevo.',
      );
    }

    if (admin.twoFactorCode !== code) {
      throw new UnauthorizedException('Código de verificación incorrecto');
    }

    // Limpiar código
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        twoFactorCode: null,
        twoFactorExpires: null,
      },
    });

    const payload = { sub: admin.id, username: admin.username };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async sendTwoFactorCode(username: string) {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Generar nuevo código y enviar
    await this.generateAndSend2FACode(admin.id, admin.email);

    return { success: true, message: 'Código reenviado correctamente.' };
  }

  // Método privado auxiliar para generar código y enviar correo
  private async generateAndSend2FACode(adminId: number, email: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        twoFactorCode: code,
        twoFactorExpires: expires,
      },
    });

    await this.mailService.sendSecurityCode(email, code);
  }
}
