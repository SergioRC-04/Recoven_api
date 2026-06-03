import { Controller, Get, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  getMail(): string {
    return this.mailService.getMail();
  }

  @Post('send-lead')
  async sendLeadNotification(@Body() createLeadDto: CreateLeadDto) {
    await this.mailService.sendLeadEmail(createLeadDto);
    return { success: true, message: 'Solicitud enviada correctamente.' };
  }
}
