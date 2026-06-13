import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // GET /customers -> Obtener el listado para el dropdown del administrador
  @Get()
  async getAllCustomers() {
    return this.customersService.findAll();
  }

  // POST /customers -> Agregar una nueva empresa desde el mini CRUD lateral
  @Post()
  async createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  // DELETE /customers/:id -> Eliminar una empresa usando su ID (UUID)
  @Delete(':id')
  async removeCustomer(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.customersService.remove(id);
  }
}
