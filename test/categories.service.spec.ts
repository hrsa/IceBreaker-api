import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CategoriesService } from "../src/categories/categories.service";
import { Category } from "../src/categories/entities/category.entity";
import { LanguageUtilsService } from "../src/common/utils/language-utils.service";
import { AppLanguage } from "../src/common/constants/app-language.enum";

describe("CategoriesService", () => {
  let service: CategoriesService;
  let repository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let languageUtilsService: { mapPropertyToField: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    languageUtilsService = {
      mapPropertyToField: jest.fn().mockImplementation(entity => entity),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: repository },
        { provide: LanguageUtilsService, useValue: languageUtilsService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe("create", () => {
    it("maps name and description into language-specific fields", async () => {
      await service.create({ language: AppLanguage.ENGLISH, name: "Fun", description: "Fun questions", isPublic: true }, "user-1");

      expect(languageUtilsService.mapPropertyToField).toHaveBeenCalledWith(expect.anything(), "name", "Fun", AppLanguage.ENGLISH);
      expect(languageUtilsService.mapPropertyToField).toHaveBeenCalledWith(
        expect.anything(),
        "description",
        "Fun questions",
        AppLanguage.ENGLISH
      );
    });

    it("assigns the owner only for private categories", async () => {
      await service.create({ language: AppLanguage.ENGLISH, name: "Private", description: "d", isPublic: false }, "user-1");

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", isPublic: false }));
    });

    it("does not assign an owner for public categories", async () => {
      await service.create({ language: AppLanguage.ENGLISH, name: "Public", description: "d", isPublic: true }, "user-1");

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ isPublic: true }));
      expect(repository.save).not.toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
    });

    it("emits the category.created event", async () => {
      await service.create({ language: AppLanguage.ENGLISH, name: "N", description: "d", isPublic: true });

      expect(eventEmitter.emit).toHaveBeenCalledWith("category.created", expect.anything());
    });
  });

  describe("findAll", () => {
    function createQueryBuilderMock() {
      return {
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: "cat-1" }]),
      };
    }

    it("filters visibility for non-admin users", async () => {
      const qb = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll("user-1", false);

      expect(qb.where).toHaveBeenCalledWith([{ isPublic: true }, { userId: "user-1", isPublic: false }]);
      expect(result).toEqual([{ id: "cat-1" }]);
    });

    it("returns everything for admins without filtering", async () => {
      const qb = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll("user-1", true);

      expect(qb.where).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("returns the category for an admin without visibility checks", async () => {
      repository.findOne.mockResolvedValue({ id: "cat-1", isPublic: false });

      const result = await service.findOne("cat-1", "someone-else", true);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: [{ id: "cat-1" }],
        relations: { cards: true },
      });
      expect(result.id).toBe("cat-1");
    });

    it("allows a user to see their own private category", async () => {
      repository.findOne.mockResolvedValue({ id: "cat-1", isPublic: false, userId: "user-1" });

      const result = await service.findOne("cat-1", "user-1", false);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: [
          { id: "cat-1", isPublic: true },
          { id: "cat-1", userId: "user-1", isPublic: false },
        ],
        relations: { cards: true },
      });
      expect(result.id).toBe("cat-1");
    });

    it("throws NotFoundException when the category does not exist", async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne("missing", "user-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("maps the new name when a language is provided", async () => {
      repository.findOne.mockResolvedValue({ id: "cat-1", name_en: "Old" });

      await service.update("cat-1", { name: "New", language: AppLanguage.ENGLISH });

      expect(languageUtilsService.mapPropertyToField).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cat-1" }),
        "name",
        "New",
        AppLanguage.ENGLISH
      );
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("throws NotFoundException when nothing was deleted", async () => {
      repository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove("missing")).rejects.toThrow(NotFoundException);
    });

    it("deletes without error when a row is affected", async () => {
      repository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.remove("cat-1")).resolves.toBeUndefined();
    });
  });

  describe("getCardsCount", () => {
    it("returns the number of related cards", async () => {
      repository.findOne.mockResolvedValue({ id: "cat-1", cards: [{}, {}, {}] });

      await expect(service.getCardsCount("cat-1")).resolves.toBe(3);
    });

    it("returns 0 for a category without cards", async () => {
      repository.findOne.mockResolvedValue({ id: "cat-1", cards: null });

      await expect(service.getCardsCount("cat-1")).resolves.toBe(0);
    });

    it("throws NotFoundException for an unknown category", async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getCardsCount("missing")).rejects.toThrow(NotFoundException);
    });
  });
});
