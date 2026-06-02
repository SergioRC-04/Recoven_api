import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getMail(): string {
    return 'Servicio de correo electrónico funcionando correctamente!';
  }
}
