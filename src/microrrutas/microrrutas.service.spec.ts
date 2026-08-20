import { Test, TestingModule } from '@nestjs/testing';
import { MicrorrutasService } from './microrrutas.service';

describe('MicrorrutasService', () => {
  let service: MicrorrutasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MicrorrutasService],
    }).compile();

    service = module.get<MicrorrutasService>(MicrorrutasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
