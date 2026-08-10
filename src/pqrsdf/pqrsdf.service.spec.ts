import { Test, TestingModule } from '@nestjs/testing';
import { PqrsdfService } from './pqrsdf.service';

describe('PqrsdfService', () => {
  let service: PqrsdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PqrsdfService],
    }).compile();

    service = module.get<PqrsdfService>(PqrsdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
