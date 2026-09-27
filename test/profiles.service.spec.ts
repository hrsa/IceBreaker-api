import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProfilesService } from "../src/profiles/profiles.service";
import { Profile } from "../src/profiles/entities/profile.entity";
import { CardPreference } from "../src/card-preferences/entitites/card-preference.entity";

describe("ProfilesService", () => {
  let service: ProfilesService;
  let profilesRepository: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; merge: jest.Mock; delete: jest.Mock };
  let cardPreferencesRepository: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    profilesRepository = {
      create: jest.fn().mockImplementation(dto => dto),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      find: jest.fn(),
      findOne: jest.fn(),
      merge: jest.fn().mockImplementation((target, source) => Object.assign(target, source)),
      delete: jest.fn(),
    };
    cardPreferencesRepository = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(Profile), useValue: profilesRepository },
        { provide: getRepositoryToken(CardPreference), useValue: cardPreferencesRepository },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  describe("create", () => {
    it("creates and saves the profile", async () => {
      const dto = { name: "Friends", userId: "user-1" };

      const result = await service.create(dto as any);

      expect(profilesRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(dto);
    });
  });

  describe("findAll", () => {
    it("queries profiles for the given user ordered by name", async () => {
      profilesRepository.find.mockResolvedValue([{ id: "p1" }]);

      const result = await service.findAll("user-1");

      expect(profilesRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        order: { name: "ASC" },
      });
      expect(result).toEqual([{ id: "p1" }]);
    });
  });

  describe("findOne", () => {
    it("returns the profile with its preferences", async () => {
      profilesRepository.findOne.mockResolvedValue({ id: "p1", userId: "user-1" });

      const result = await service.findOne("p1", "user-1");

      expect(profilesRepository.findOne).toHaveBeenCalledWith({
        where: { id: "p1" },
        relations: ["cardPreferences", "cardPreferences.card"],
      });
      expect(result.id).toBe("p1");
    });

    it("throws NotFoundException for an unknown profile", async () => {
      profilesRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne("missing", "user-1")).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for another user's profile", async () => {
      profilesRepository.findOne.mockResolvedValue({ id: "p1", userId: "owner" });

      await expect(service.findOne("p1", "intruder")).rejects.toThrow(ForbiddenException);
    });

    it("allows admins to access any profile", async () => {
      profilesRepository.findOne.mockResolvedValue({ id: "p1", userId: "owner" });

      await expect(service.findOne("p1", "admin", true)).resolves.toEqual({
        id: "p1",
        userId: "owner",
      });
    });
  });

  describe("update", () => {
    it("merges the dto into the profile and saves", async () => {
      profilesRepository.findOne.mockResolvedValue({ id: "p1", name: "Old", userId: "user-1" });

      const result = await service.update("p1", "user-1", { name: "New" } as any);

      expect(result.name).toBe("New");
      expect(profilesRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
    });
  });

  describe("remove", () => {
    it("deletes an owned profile", async () => {
      profilesRepository.findOne.mockResolvedValue({ id: "p1", userId: "user-1" });

      await service.remove("p1", "user-1");

      expect(profilesRepository.delete).toHaveBeenCalledWith("p1");
    });

    it("propagates ownership errors", async () => {
      profilesRepository.findOne.mockResolvedValue({ id: "p1", userId: "owner" });

      await expect(service.remove("p1", "intruder")).rejects.toThrow(ForbiddenException);
      expect(profilesRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("getCardPreferences", () => {
    function createQueryBuilderMock() {
      return {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: "pref-1" }]),
      };
    }

    it("filters by a valid status", async () => {
      const qb = createQueryBuilderMock();
      cardPreferencesRepository.createQueryBuilder.mockReturnValue(qb);
      profilesRepository.findOne.mockResolvedValue({ id: "p1", userId: "user-1" });

      const result = await service.getCardPreferences("p1", "archived", "user-1");

      expect(qb.andWhere).toHaveBeenCalledWith("preference.status = :status", { status: "archived" });
      expect(result).toEqual([{ id: "pref-1" }]);
    });

    it("ignores an invalid status instead of filtering", async () => {
      const qb = createQueryBuilderMock();
      cardPreferencesRepository.createQueryBuilder.mockReturnValue(qb);
      profilesRepository.findOne.mockResolvedValue({ id: "p1", userId: "user-1" });

      await service.getCardPreferences("p1", "not-a-status", "user-1");

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it("requires the profile to exist first", async () => {
      profilesRepository.findOne.mockResolvedValue(null);

      await expect(service.getCardPreferences("missing")).rejects.toThrow(NotFoundException);
      expect(cardPreferencesRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
