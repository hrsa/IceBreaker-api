import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import * as argon2 from "argon2";
import { UsersService } from "../src/users/users.service";
import { User } from "../src/users/entities/user.entity";

describe("UsersService", () => {
  let service: UsersService;
  let usersRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; find: jest.Mock; delete: jest.Mock; merge: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation(dto => dto),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      merge: jest.fn().mockImplementation((target, source) => Object.assign(target, source)),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe("create", () => {
    it("rejects a duplicate email with BadRequest", async () => {
      usersRepository.findOne.mockResolvedValue({ id: "existing", email: "taken@test.net" });

      await expect(
        service.create({ email: "taken@test.net", password: "password", name: "N" } as any)
      ).rejects.toThrow(BadRequestException);
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it("hashes the password before saving", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.create({
        email: "new@test.net",
        password: "plaintext",
        name: "N",
      } as any);

      expect(result.password).not.toBe("plaintext");
      await expect(argon2.verify(result.password, "plaintext")).resolves.toBe(true);
    });

    it("generates a secret phrase for non-telegram users", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.create({
        email: "new@test.net",
        password: "password",
        name: "N",
      } as any);

      expect(typeof result.secretPhrase).toBe("string");
      expect(result.secretPhrase.length).toBeGreaterThan(0);
    });
  });

  describe("findByEmail", () => {
    it("throws BadRequest for an empty email", async () => {
      await expect(service.findByEmail("")).rejects.toThrow(BadRequestException);
      expect(usersRepository.findOne).not.toHaveBeenCalled();
    });

    it("throws NotFound for an unknown email", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.findByEmail("ghost@test.net")).rejects.toThrow(NotFoundException);
    });

    it("returns the user for a known email", async () => {
      usersRepository.findOne.mockResolvedValue({ id: "u1", email: "known@test.net" });

      await expect(service.findByEmail("known@test.net")).resolves.toEqual({
        id: "u1",
        email: "known@test.net",
      });
    });
  });

  describe("connectTelegram", () => {
    it("links the telegram id and clears the secret phrase", async () => {
      usersRepository.findOne.mockResolvedValue({
        id: "u1",
        secretPhrase: "magic words",
        telegramId: null,
      });

      const result = await service.connectTelegram(123456, "magic words");

      expect(result.telegramId).toBe("123456");
      expect(result.secretPhrase).toBe("");
      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ telegramId: "123456", secretPhrase: "" })
      );
    });
  });

  describe("update", () => {
    it("hashes a new password before merging", async () => {
      usersRepository.findOne.mockResolvedValue({ id: "u1", password: "old-hash" });

      const result = await service.update("u1", { password: "new-plaintext" } as any);

      expect(result.password).not.toBe("new-plaintext");
      expect(result.password).not.toBe("old-hash");
    });

    it("propagates NotFound for an unknown user", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.update("missing", { name: "X" } as any)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("validateUser", () => {
    it("returns the user for valid credentials", async () => {
      const password = await argon2.hash("correct-password");
      usersRepository.findOne.mockResolvedValue({
        id: "u1",
        email: "user@test.net",
        password,
        isActivated: true,
      });

      await expect(service.validateUser("user@test.net", "correct-password")).resolves.toEqual(
        expect.objectContaining({ id: "u1" })
      );
    });

    it("rejects an unknown email with Unauthorized", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.validateUser("ghost@test.net", "whatever")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("rejects a wrong password with Unauthorized", async () => {
      const password = await argon2.hash("correct-password");
      usersRepository.findOne.mockResolvedValue({ id: "u1", password, isActivated: true });

      await expect(service.validateUser("user@test.net", "wrong-password")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("rejects a deactivated account with Unauthorized", async () => {
      const password = await argon2.hash("correct-password");
      usersRepository.findOne.mockResolvedValue({ id: "u1", password, isActivated: false });

      await expect(service.validateUser("user@test.net", "correct-password")).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("addCredit", () => {
    it("adds credits to the user found by email", async () => {
      usersRepository.findOne.mockResolvedValue({ id: "u1", email: "user@test.net", credits: 5, telegramId: null });

      const result = await service.addCredit(undefined, "user@test.net", 3);

      expect(result.credits).toBe(8);
      expect(usersRepository.save).toHaveBeenCalledWith(expect.objectContaining({ credits: 8 }));
    });

    it("emits the user.credits.updated event", async () => {
      usersRepository.findOne.mockResolvedValue({ id: "u1", credits: 5, telegramId: null });

      await service.addCredit("u1", undefined, 1);

      expect(eventEmitter.emit).toHaveBeenCalledWith("user.credits.updated", expect.anything());
    });

    it("throws NotFound when neither id nor email matches", async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.addCredit(undefined, "ghost@test.net", 1)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
