import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
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
    // 1. 🟢 Obligamos al controlador a esperar la confirmación real de la base de datos
    await this.customersService.remove(id);

    // 2. Solo cuando la línea de arriba termine con éxito, respondemos al Frontend
    return {
      success: true,
      message: 'Empresa eliminada correctamente.',
    };
  }

  // PUT /customers/:id -> Reemplaza nombre y correo. Reutiliza CreateCustomerDto
  // a propósito (antes era un tipo inline sin ninguna validación real) — al
  // ser un PUT, es correcto exigir el recurso completo, no una versión
  // parcial con PartialType.
  @Put(':id')
  async updateCustomer(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateCustomerDto: CreateCustomerDto,
  ) {
    const empresaActualizada = await this.customersService.update(
      id,
      updateCustomerDto,
    );
    return {
      success: true,
      message: 'Empresa actualizada correctamente.',
      data: empresaActualizada,
    };
  }
}
