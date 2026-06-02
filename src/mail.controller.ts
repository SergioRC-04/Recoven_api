import { Controller, Get } from '@nestjs/common';
import { AppService } from './mail.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('mail')
  getMail(): string {
    return this.appService.getMail();
  }
}
