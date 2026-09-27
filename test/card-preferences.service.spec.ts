import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { CardPreferencesService } from "../src/card-preferences/card-preferences.service";
import { CardPreference, CardStatus } from "../src/card-preferences/entitites/card-preference.entity";
import { ProfilesService } from "../src/profiles/profiles.service";
import { CardsService } from "../src/cards/cards.service";

describe("CardPreferencesService", () => {
  let service: CardPreferencesService;
  let preferencesRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let profilesService: { findOne: jest.Mock };
  let cardsService: { findOne: jest.Mock };

  beforeEach(async () => {
    preferencesRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation(dto => ({ ...dto })),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    profilesService = { findOne: jest.fn().mockResolvedValue({ id: "profile-1" }) };
    cardsService = { findOne: jest.fn().mockResolvedValue({ id: "card-1" }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardPreferencesService,
        { provide: getRepositoryToken(CardPreference), useValue: preferencesRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: CardsService, useValue: cardsService },
      ],
    }).compile();

    service = module.get<CardPreferencesService>(CardPreferencesService);
  });

  describe("updatePreference", () => {
    it("creates a preference when none exists and the status is not active", async () => {
      preferencesRepository.findOne.mockResolvedValue(null);

      const result = await service.updatePreference("card-1", "profile-1", {
        status: CardStatus.ARCHIVED,
      } as any);
      if (!result) throw new Error("Preference was not created");

      expect(preferencesRepository.create).toHaveBeenCalledWith({
        cardId: "card-1",
        profileId: "profile-1",
        status: CardStatus.ARCHIVED,
      });
      expect(result.status).toBe(CardStatus.ARCHIVED);
    });

    it("returns null without creating anything when reactivating an untouched card", async () => {
      preferencesRepository.findOne.mockResolvedValue(null);

      const result = await service.updatePreference("card-1", "profile-1", {
        status: CardStatus.ACTIVE,
      } as any);

      expect(result).toBeNull();
      expect(preferencesRepository.create).not.toHaveBeenCalled();
      expect(preferencesRepository.save).not.toHaveBeenCalled();
    });

    it("updates the status of an existing preference", async () => {
      // Regression: the old implementation never assigned the new status,
      // so transitioning a loved card to archived kept it loved.
      preferencesRepository.findOne.mockResolvedValue({
        id: "pref-1",
        cardId: "card-1",
        profileId: "profile-1",
        status: CardStatus.LOVED,
        lastInteractionAt: new Date("2026-01-01T00:00:00Z"),
      });

      const result = await service.updatePreference("card-1", "profile-1", {
        status: CardStatus.ARCHIVED,
      } as any);
      if (!result) throw new Error("Preference was not updated");

      expect(result.status).toBe(CardStatus.ARCHIVED);
      expect(preferencesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CardStatus.ARCHIVED })
      );
    });

    it("deletes the preference by primary key on reactivation", async () => {
      // Regression: delete(entity) built a WHERE clause from every column,
      // and microsecond-precision timestamps silently deleted 0 rows.
      const existing = {
        id: "pref-1",
        cardId: "card-1",
        profileId: "profile-1",
        status: CardStatus.BANNED,
        lastInteractionAt: new Date(),
      };
      preferencesRepository.findOne.mockResolvedValue(existing);

      const result = await service.updatePreference("card-1", "profile-1", {
        status: CardStatus.ACTIVE,
      } as any);

      expect(result).toBeNull();
      expect(preferencesRepository.delete).toHaveBeenCalledWith("pref-1");
      expect(preferencesRepository.delete).not.toHaveBeenCalledWith(existing);
    });

    it("validates the card exists before updating", async () => {
      cardsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.updatePreference("missing-card", "profile-1", { status: CardStatus.BANNED } as any)
      ).rejects.toThrow(NotFoundException);
      expect(preferencesRepository.save).not.toHaveBeenCalled();
    });

    it("validates the profile exists before updating", async () => {
      profilesService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.updatePreference("card-1", "missing-profile", { status: CardStatus.BANNED } as any)
      ).rejects.toThrow(NotFoundException);
      expect(preferencesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("status shortcuts", () => {
    it.each([
      ["archiveCard", CardStatus.ARCHIVED],
      ["banCard", CardStatus.BANNED],
      ["loveCard", CardStatus.LOVED],
      ["reactivateCard", CardStatus.ACTIVE],
    ])("%s delegates to updatePreference with the right status", async (method, status) => {
      preferencesRepository.findOne.mockResolvedValue({
        id: "pref-1",
        cardId: "card-1",
        profileId: "profile-1",
        status: CardStatus.ACTIVE,
        lastInteractionAt: new Date(),
      });

      const shortcut = (service[method as "archiveCard"] as unknown as (
        cardId: string,
        profileId: string
      ) => unknown).bind(service);
      await shortcut("card-1", "profile-1");

      if (status === CardStatus.ACTIVE) {
        expect(preferencesRepository.delete).toHaveBeenCalledWith("pref-1");
      } else {
        expect(preferencesRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ status })
        );
      }
    });
  });

  describe("findAll", () => {
    function createQueryBuilderMock() {
      return {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: "pref-1", status: CardStatus.LOVED }]),
      };
    }

    it("returns all preferences for a profile", async () => {
      const qb = createQueryBuilderMock();
      preferencesRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll("profile-1");

      expect(qb.where).toHaveBeenCalledWith("preference.profileId = :profileId", {
        profileId: "profile-1",
      });
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result[0].status).toBe(CardStatus.LOVED);
    });

    it("filters by status when provided", async () => {
      const qb = createQueryBuilderMock();
      preferencesRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll("profile-1", "loved");

      expect(qb.andWhere).toHaveBeenCalledWith("preference.status = :status", { status: "loved" });
    });
  });

  describe("status-specific getters", () => {
    it.each([
      ["getActiveCardsForProfile", CardStatus.ACTIVE],
      ["getArchivedCardsForProfile", CardStatus.ARCHIVED],
      ["getBannedCardsForProfile", CardStatus.BANNED],
      ["getLovedCardsForProfile", CardStatus.LOVED],
    ])("%s queries with the expected status", async (method, status) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      preferencesRepository.createQueryBuilder.mockReturnValue(qb);

      const getter = (service[method as "getActiveCardsForProfile"] as unknown as (
        profileId: string
      ) => unknown).bind(service);
      await getter("profile-1");

      expect(qb.andWhere).toHaveBeenCalledWith("preference.status = :status", { status });
    });
  });
});
