import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import { SuggestionsService } from "../src/suggestions/suggestions.service";
import { Suggestion } from "../src/suggestions/entities/suggestion.entity";

describe("SuggestionsService", () => {
  let service: SuggestionsService;
  let suggestionsRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    merge: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    suggestionsRepository = {
      create: jest.fn().mockImplementation(dto => dto),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      findOneBy: jest.fn(),
      merge: jest.fn().mockImplementation((target, source) => Object.assign(target, source)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue("admin-chat-id") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: getRepositoryToken(Suggestion), useValue: suggestionsRepository },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SuggestionsService>(SuggestionsService);
  });

  describe("create", () => {
    it("notifies the admin via telegram about the new suggestion", () => {
      service.create({ userId: "u1", question: "A great idea?" } as any);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "telegram.message",
        expect.objectContaining({})
      );
      expect(configService.getOrThrow).toHaveBeenCalledWith("ADMIN_TELEGRAM_ID");
    });

    it("saves the suggestion", async () => {
      await service.create({ userId: "u1", question: "Q?" } as any);

      expect(suggestionsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ question: "Q?" })
      );
    });
  });

  describe("findAll", () => {
    it("queries suggestions for the given user with relations", async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: "s1" }]),
      };
      suggestionsRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll("u1");

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith("suggestion.user", "user");
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith("suggestion.category", "category");
      expect(qb.where).toHaveBeenCalledWith("user.id = :userId", { userId: "u1" });
      expect(result).toEqual([{ id: "s1" }]);
    });
  });

  describe("findOne", () => {
    it("returns the suggestion to its owner", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue({ id: "s1", userId: "u1" });

      await expect(service.findOne("s1", "u1", false)).resolves.toEqual({ id: "s1", userId: "u1" });
    });

    it("throws Forbidden for another user's suggestion", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue({ id: "s1", userId: "owner" });

      await expect(service.findOne("s1", "intruder", false)).rejects.toThrow(ForbiddenException);
    });

    it("lets admins read any suggestion", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue({ id: "s1", userId: "owner" });

      await expect(service.findOne("s1", "admin", true)).resolves.toEqual({
        id: "s1",
        userId: "owner",
      });
    });

    it("throws NotFound for an unknown suggestion", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne("missing", "u1", false)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("merges the dto into the suggestion", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue({ id: "s1", accepted: false });

      const result = await service.update("s1", { accepted: true } as any);

      expect(result.accepted).toBe(true);
      expect(suggestionsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ accepted: true })
      );
    });

    it("throws NotFound for an unknown suggestion", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.update("missing", {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes the suggestion when it exists", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue({ id: "s1" });

      await service.remove("s1");

      expect(suggestionsRepository.delete).toHaveBeenCalledWith("s1");
    });

    it("throws NotFound for an unknown suggestion", async () => {
      suggestionsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove("missing")).rejects.toThrow(NotFoundException);
      expect(suggestionsRepository.delete).not.toHaveBeenCalled();
    });
  });
});
