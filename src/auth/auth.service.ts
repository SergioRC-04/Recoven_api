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

    // 1. Generar código aleatorio de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Definir expiración (5 minutos)
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    // 3. Guardar en la base de datos local SQLite
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        twoFactorCode: code,
        twoFactorExpires: expires,
      },
    });

    await this.mailService.sendSecurityCode(admin.email, code);

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

    // 1. Verificar si el código ya expiró
    if (new Date() > admin.twoFactorExpires!) {
      throw new BadRequestException(
        'El código ha expirado. Solicita uno nuevo.',
      );
    }

    // 2. Verificar si el código coincide
    if (admin.twoFactorCode !== code) {
      throw new UnauthorizedException('Código de verificación incorrecto');
    }

    // 3. Limpiar el código en la BD para que no se pueda reutilizar
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        twoFactorCode: null,
        twoFactorExpires: null,
      },
    });

    // 4. Entregar el JWT definitivo
    const payload = { sub: admin.id, username: admin.username };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
