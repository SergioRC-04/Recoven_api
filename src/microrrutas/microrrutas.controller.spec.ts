import { Test, TestingModule } from '@nestjs/testing';
import { MicrorrutasController } from './microrrutas.controller';
import { MicrorrutasService } from './microrrutas.service';

describe('MicrorrutasController', () => {
  let controller: MicrorrutasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MicrorrutasController],
      providers: [MicrorrutasService],
    }).compile();

    controller = module.get<MicrorrutasController>(MicrorrutasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
