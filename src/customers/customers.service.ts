import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Obtener todas las empresas ordenadas alfabéticamente
  async findAll() {
    return this.prisma.empresasClientes.findMany({
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  // 2. Crear una nueva empresa cliente
  async create(createCustomerDto: CreateCustomerDto) {
    const { nombre, correo } = createCustomerDto;

    // Verificar si ya existe una empresa con ese nombre (evitar duplicados redundantes)
    const existeEmpresa = await this.prisma.empresasClientes.findUnique({
      where: { nombre },
    });

    if (existeEmpresa) {
      throw new ConflictException(
        'Ya existe una empresa registrada con este nombre.',
      );
    }

    return this.prisma.empresasClientes.create({
      data: {
        nombre,
        correo,
      },
    });
  }

  // 3. Eliminar una empresa por ID
  async remove(id: string) {
    // Verificar si la empresa existe antes de intentar borrarla
    const empresa = await this.prisma.empresasClientes.findUnique({
      where: { id },
    });

    if (!empresa) {
      throw new NotFoundException('La empresa que intenta eliminar no existe.');
    }

    // Nota de seguridad: Si la empresa ya tiene certificados asignados,
    // Prisma lanzará un error de clave foránea (Foreign Key Restriction) automáticamente,
    // protegiendo la integridad de tus datos.
    return this.prisma.empresasClientes.delete({
      where: { id },
    });
  }
}
