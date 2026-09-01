import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

const HASH_SEÑUELO =
  '$2b$10$hbONoBunyob8mIDq48sAueAbJ30Tq69KxqR/BvC26R1tAjMi4hvDS';

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

    const hashParaComparar = admin?.password ?? HASH_SEÑUELO;
    const isPasswordValid = await bcrypt.compare(password, hashParaComparar);

    if (!admin || !isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

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

  async sendTwoFactorCode(
    username: string,
  ): Promise<{ success: true; message: string }> {
    const admin = await this.prisma.admin.findUnique({ where: { username } });

    if (admin) {
      this.generateAndSend2FACode(admin.id, admin.email).catch((err) =>
        console.error('Error generando/enviando código 2FA:', err),
      );
    }

    return {
      success: true,
      message: 'Si el usuario existe, se reenvió el código.',
    };
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
