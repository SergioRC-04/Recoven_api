import { Test, TestingModule } from '@nestjs/testing';
import { PqrsdfController } from './pqrsdf.controller';
import { PqrsdfService } from './pqrsdf.service';

describe('PqrsdfController', () => {
  let controller: PqrsdfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PqrsdfController],
      providers: [PqrsdfService],
    }).compile();

    controller = module.get<PqrsdfController>(PqrsdfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
