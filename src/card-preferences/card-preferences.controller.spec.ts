import { Test, TestingModule } from '@nestjs/testing';
import { CardPreferencesController } from './card-preferences.controller';

describe('CardPreferencesController', () => {
  let controller: CardPreferencesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardPreferencesController],
    }).compile();

    controller = module.get<CardPreferencesController>(CardPreferencesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
