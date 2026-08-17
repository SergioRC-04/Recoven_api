import { Test, TestingModule } from '@nestjs/testing';
import { GeoTerritorioService } from './geo-territorio.service';

describe('GeoTerritorioService', () => {
  let service: GeoTerritorioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeoTerritorioService],
    }).compile();

    service = module.get<GeoTerritorioService>(GeoTerritorioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
