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
  async remove(id: string): Promise<any> {
    // 1. Verificar si la empresa existe antes de intentar borrarla
    const empresa = await this.prisma.empresasClientes.findUnique({
      where: { id },
    });

    if (!empresa) {
      throw new NotFoundException('La empresa que intenta eliminar no existe.');
    }

    // 2. 🟢 CORREGIDO: Ejecutamos con await y guardamos el resultado del borrado real
    const resultadoBorrado = await this.prisma.empresasClientes.delete({
      where: { id },
    });

    // 3. Retornamos el resultado para confirmar que la promesa se resolvió con éxito
    return resultadoBorrado;
  }

  async update(id: string, data: { nombre?: string; correo?: string }) {
    // Validar si existe antes de actualizar
    const existe = await this.prisma.empresasClientes.findUnique({
      where: { id },
    });
    if (!existe) {
      throw new NotFoundException(
        'La empresa que intenta actualizar no existe.',
      );
    }

    return this.prisma.empresasClientes.update({
      where: { id },
      data,
    });
  }
}
