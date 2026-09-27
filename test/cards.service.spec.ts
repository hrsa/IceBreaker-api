import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CardsService } from "../src/cards/cards.service";
import { Card } from "../src/cards/entities/card.entity";
import { CardPreference, CardStatus } from "../src/card-preferences/entitites/card-preference.entity";
import { CategoriesService } from "../src/categories/categories.service";
import { LanguageUtilsService } from "../src/common/utils/language-utils.service";
import { GetRandomCardDto } from "../src/cards/dto/get-random-card.dto";

type MockQueryBuilder = {
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  getMany: jest.Mock;
  subQuery: jest.Mock;
  from: jest.Mock;
  getQuery: jest.Mock;
};

function createMockQueryBuilder(): MockQueryBuilder {
  const qb: MockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    subQuery: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    getQuery: jest.fn().mockReturnValue("subquery"),
  };
  return qb;
}

describe("CardsService - getRandomCard", () => {
  let service: CardsService;
  let cardRepository: { createQueryBuilder: jest.Mock; save: jest.Mock };

  const dto: GetRandomCardDto = {
    profileId: "5f1fe788-a417-464d-9e39-63cf378d3d5b",
    categoryIds: [],
    includeArchived: false,
    includeLoved: false,
    limit: 3,
  };

  const queryBuilderDefaults = () => {
    const idQuery = createMockQueryBuilder();
    idQuery.getMany.mockResolvedValue([{ id: "card-1" }, { id: "card-2" }]);
    const entityQuery = createMockQueryBuilder();
    entityQuery.getMany.mockResolvedValue([
      {
        id: "card-1",
        question_en: "Q1",
        category: { id: "cat-1" },
        profilePreferences: [{ id: "pref-1", status: CardStatus.ACTIVE }],
      },
      {
        id: "card-2",
        question_en: "Q2",
        category: { id: "cat-1" },
        profilePreferences: [],
      },
    ]);
    return { idQuery, entityQuery };
  };

  beforeEach(async () => {
    const { idQuery, entityQuery } = queryBuilderDefaults();
    cardRepository = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(idQuery).mockReturnValueOnce(entityQuery),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsService,
        { provide: getRepositoryToken(Card), useValue: cardRepository },
        {
          provide: CategoriesService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn().mockResolvedValue([{ id: "cat-1" }]),
          },
        },
        { provide: LanguageUtilsService, useValue: { mapPropertyToField: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<CardsService>(CardsService);
  });

  it("uses a two-step query: random IDs first, then entities with relations", async () => {
    const { idQuery, entityQuery } = queryBuilderDefaults();
    cardRepository.createQueryBuilder
      .mockReset()
      .mockReturnValueOnce(idQuery)
      .mockReturnValueOnce(entityQuery);

    await service.getRandomCard(dto, "user-1");

    // Step 1: fetch only IDs ordered randomly (no joins -> no DISTINCT in ORDER BY)
    expect(cardRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(idQuery.select).toHaveBeenCalledWith("card.id");
    expect(idQuery.orderBy).toHaveBeenCalledWith("RANDOM()");
    expect(idQuery.limit).toHaveBeenCalledWith(3);
    expect(idQuery.leftJoinAndSelect).not.toHaveBeenCalled();

    // Step 2: fetch full entities with relations filtered by the selected IDs
    expect(entityQuery.leftJoinAndSelect).toHaveBeenCalledWith("card.category", "category");
    expect(entityQuery.where).toHaveBeenCalledWith(
      "card.id IN (:...cardIds)",
      expect.objectContaining({ cardIds: ["card-1", "card-2"] })
    );
    expect(entityQuery.orderBy).not.toHaveBeenCalledWith("RANDOM()");
  });

  it("maps the profile preference onto cardPreference when it exists", async () => {
    const cards = await service.getRandomCard(dto, "user-1");

    expect(cards).toHaveLength(2);
    expect(cards[0].cardPreference).toEqual({ id: "pref-1", status: CardStatus.ACTIVE });
    expect(cards[1].cardPreference).toBeUndefined();
  });

  it("throws NotFoundException when no accessible categories exist", async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsService,
        { provide: getRepositoryToken(Card), useValue: cardRepository },
        {
          provide: CategoriesService,
          useValue: { findOne: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
        },
        { provide: LanguageUtilsService, useValue: { mapPropertyToField: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    const serviceWithoutCategories = module.get<CardsService>(CardsService);

    await expect(serviceWithoutCategories.getRandomCard(dto, "user-1")).rejects.toThrow(
      new NotFoundException("No accessible categories found")
    );
    expect(cardRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when no cards match the criteria", async () => {
    const idQuery = createMockQueryBuilder();
    idQuery.getMany.mockResolvedValue([]);
    cardRepository.createQueryBuilder.mockReset().mockReturnValueOnce(idQuery);

    await expect(service.getRandomCard(dto, "user-1")).rejects.toThrow(
      new NotFoundException("No cards found matching the criteria")
    );
  });

  it("validates requested categories before querying", async () => {
    const { idQuery, entityQuery } = queryBuilderDefaults();
    cardRepository.createQueryBuilder
      .mockReset()
      .mockReturnValueOnce(idQuery)
      .mockReturnValueOnce(entityQuery);

    const categoriesService = (service as any).categoriesService as CategoriesService;
    (categoriesService.findAll as jest.Mock).mockResolvedValue([]);
    (categoriesService.findOne as jest.Mock).mockImplementation(
      (id: string) => (id === "cat-ok" ? Promise.resolve({ id }) : Promise.reject(new Error()))
    );

    const cards = await service.getRandomCard(
      { ...dto, categoryIds: ["cat-ok", "cat-bad"] },
      "user-1"
    );

    expect(categoriesService.findOne).toHaveBeenCalledTimes(2);
    expect(cards).toHaveLength(2);
    expect(idQuery.where).toHaveBeenCalledWith(
      "card.categoryId IN (:...validCategoryIds)",
      expect.objectContaining({ validCategoryIds: ["cat-ok"] })
    );
  });
});
