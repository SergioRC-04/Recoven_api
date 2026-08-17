import { Test, TestingModule } from '@nestjs/testing';
import { GeoTerritorioController } from './geo-territorio.controller';
import { GeoTerritorioService } from './geo-territorio.service';

describe('GeoTerritorioController', () => {
  let controller: GeoTerritorioController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoTerritorioController],
      providers: [GeoTerritorioService],
    }).compile();

    controller = module.get<GeoTerritorioController>(GeoTerritorioController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
