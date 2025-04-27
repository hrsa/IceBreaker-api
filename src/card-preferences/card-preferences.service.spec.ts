import { Test, TestingModule } from '@nestjs/testing';
import { CardPreferencesService } from './card-preferences.service';

describe('CardPreferencesService', () => {
  let service: CardPreferencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardPreferencesService],
    }).compile();

    service = module.get<CardPreferencesService>(CardPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
