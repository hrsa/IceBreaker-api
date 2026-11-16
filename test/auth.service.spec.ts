import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { createHash } from "node:crypto";
import { AuthService } from "../src/auth/auth.service";
import { PasswordReset } from "../src/auth/entities/password-reset.entity";
import { RefreshToken } from "../src/auth/entities/refresh-token.entity";
import { UsersService } from "../src/users/users.service";

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

describe("AuthService", () => {
  let service: AuthService;
  let resetRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let refreshRepository: { save: jest.Mock; findOneBy: jest.Mock; update: jest.Mock };
  let usersService: { findByEmail: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    resetRepository = {
      create: jest.fn().mockImplementation(dto => dto),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
    };
    refreshRepository = {
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    };
    usersService = {
      findByEmail: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    };
    jwtService = { sign: jest.fn().mockReturnValue("signed-token") };
    configService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => (key === "REFRESH_TOKEN_TTL_DAYS" ? 365 : (defaultValue ?? "secret"))),
      getOrThrow: jest.fn().mockReturnValue("secret"),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(PasswordReset), useValue: resetRepository },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepository },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("login", () => {
    it("signs a jwt and issues a hashed refresh token in a new family", async () => {
      const result = await service.login({ id: "user-1", email: "user@test.net" } as any);

      expect(jwtService.sign).toHaveBeenCalledWith({ sub: "user-1", email: "user@test.net" });
      expect(result.accessToken).toBe("signed-token");

      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe("string");
      expect(refreshRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          tokenHash: sha256(result.refreshToken),
          familyId: expect.any(String),
          expiresAt: expect.any(Date),
        })
      );
    });

    it("sets the refresh token expiry from the configured ttl", async () => {
      await service.login({ id: "user-1", email: "user@test.net" } as any);

      const { expiresAt } = refreshRepository.save.mock.calls[0][0];
      const expected = Date.now() + 365 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThan(expected - 60 * 1000);
      expect(expiresAt.getTime()).toBeLessThan(expected + 60 * 1000);
    });
  });

  describe("refresh token ttl configuration", () => {
    it("falls back to 365 days for an empty or malformed value", async () => {
      // An env var that exists but is empty ("REFRESH_TOKEN_TTL_DAYS=") must
      // not produce a zero-day ttl.
      const brokenConfig = {
        get: jest
          .fn()
          .mockImplementation((key: string, defaultValue?: unknown) =>
            key === "REFRESH_TOKEN_TTL_DAYS" ? "" : (defaultValue ?? "secret")
          ),
        getOrThrow: jest.fn().mockReturnValue("secret"),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: getRepositoryToken(PasswordReset), useValue: resetRepository },
          { provide: getRepositoryToken(RefreshToken), useValue: refreshRepository },
          { provide: UsersService, useValue: usersService },
          { provide: JwtService, useValue: jwtService },
          { provide: ConfigService, useValue: brokenConfig },
          { provide: EventEmitter2, useValue: eventEmitter },
        ],
      }).compile();
      const brokenService = module.get<AuthService>(AuthService);

      await brokenService.login({ id: "user-1", email: "user@test.net" } as any);

      const { expiresAt } = refreshRepository.save.mock.calls[0][0];
      const expected = Date.now() + 365 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThan(expected - 60 * 1000);
      expect(expiresAt.getTime()).toBeLessThan(expected + 60 * 1000);
    });
  });

  describe("refresh", () => {
    const activeUser = { id: "user-1", email: "user@test.net", isActivated: true };
    const validRecord = {
      id: "rt-1",
      tokenHash: sha256("valid-refresh-token"),
      familyId: "fam-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      rotatedAt: null,
      revokedAt: null,
    };

    it("rotates the token family and returns a new pair", async () => {
      refreshRepository.findOneBy.mockResolvedValue(validRecord);
      usersService.findOne.mockResolvedValue(activeUser);

      const result = await service.refresh("valid-refresh-token");

      expect(result.accessToken).toBe("signed-token");
      expect(result.refreshToken).not.toBe("valid-refresh-token");
      expect(refreshRepository.update).toHaveBeenCalledWith("rt-1", { rotatedAt: expect.any(Date) });
      expect(refreshRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          familyId: "fam-1",
          userId: "user-1",
          tokenHash: sha256(result.refreshToken),
          expiresAt: expect.any(Date),
        })
      );
    });

    it("rejects an unknown token with Unauthorized", async () => {
      refreshRepository.findOneBy.mockResolvedValue(null);

      await expect(service.refresh("ghost-token")).rejects.toThrow(UnauthorizedException);
      expect(refreshRepository.update).not.toHaveBeenCalled();
      expect(refreshRepository.save).not.toHaveBeenCalled();
    });

    it("rejects an expired token with Unauthorized", async () => {
      refreshRepository.findOneBy.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh("valid-refresh-token")).rejects.toThrow(UnauthorizedException);
      expect(refreshRepository.update).not.toHaveBeenCalled();
    });

    it("rejects a revoked token with Unauthorized", async () => {
      refreshRepository.findOneBy.mockResolvedValue({
        ...validRecord,
        revokedAt: new Date(),
      });

      await expect(service.refresh("valid-refresh-token")).rejects.toThrow(UnauthorizedException);
      expect(refreshRepository.update).not.toHaveBeenCalled();
    });

    it("revokes the whole family when an already-rotated token is replayed", async () => {
      refreshRepository.findOneBy.mockResolvedValue({
        ...validRecord,
        rotatedAt: new Date(),
      });

      await expect(service.refresh("valid-refresh-token")).rejects.toThrow(UnauthorizedException);

      expect(refreshRepository.update).toHaveBeenCalledWith(expect.objectContaining({ familyId: "fam-1" }), {
        revokedAt: expect.any(Date),
      });
      expect(refreshRepository.save).not.toHaveBeenCalled();
    });

    it("rejects a deactivated user with Unauthorized", async () => {
      refreshRepository.findOneBy.mockResolvedValue(validRecord);
      usersService.findOne.mockResolvedValue({ ...activeUser, isActivated: false });

      await expect(service.refresh("valid-refresh-token")).rejects.toThrow(UnauthorizedException);
      expect(refreshRepository.save).not.toHaveBeenCalled();
    });

    it("maps a deleted user to Unauthorized", async () => {
      refreshRepository.findOneBy.mockResolvedValue(validRecord);
      usersService.findOne.mockRejectedValue(new NotFoundException("User not found"));

      await expect(service.refresh("valid-refresh-token")).rejects.toThrow(UnauthorizedException);
      expect(refreshRepository.save).not.toHaveBeenCalled();
    });

    it("propagates errors other than NotFound from the user lookup", async () => {
      refreshRepository.findOneBy.mockResolvedValue(validRecord);
      usersService.findOne.mockRejectedValue(new BadRequestException("driver gone"));

      await expect(service.refresh("valid-refresh-token")).rejects.toThrow(BadRequestException);
    });
  });

  describe("logout", () => {
    it("revokes the token family", async () => {
      refreshRepository.findOneBy.mockResolvedValue({
        id: "rt-1",
        familyId: "fam-1",
        userId: "user-1",
      });

      await expect(service.logout("known-token")).resolves.toBeUndefined();

      expect(refreshRepository.update).toHaveBeenCalledWith(expect.objectContaining({ familyId: "fam-1" }), {
        revokedAt: expect.any(Date),
      });
    });

    it("is a silent no-op for an unknown token", async () => {
      refreshRepository.findOneBy.mockResolvedValue(null);

      await expect(service.logout("ghost-token")).resolves.toBeUndefined();

      expect(refreshRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("revokeAllForUser", () => {
    it("revokes every active token of the user", async () => {
      await service.revokeAllForUser("user-1");

      expect(refreshRepository.update).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }), { revokedAt: expect.any(Date) });
    });
  });

  describe("requestPasswordReset", () => {
    it("creates a reset record and sends the email for a known user", async () => {
      usersService.findByEmail.mockResolvedValue({ id: "user-1", email: "user@test.net" });

      await service.requestPasswordReset("user@test.net");

      expect(resetRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", token: "signed-token" }));
      expect(eventEmitter.emit).toHaveBeenCalledWith("send.email", expect.anything());
    });

    it("returns silently for an unknown email without leaking existence", async () => {
      usersService.findByEmail.mockRejectedValue(new NotFoundException("User with email not found"));

      await expect(service.requestPasswordReset("ghost@test.net")).resolves.toBeUndefined();

      expect(resetRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("propagates errors other than NotFound", async () => {
      usersService.findByEmail.mockRejectedValue(new BadRequestException("Email is required"));

      await expect(service.requestPasswordReset("")).rejects.toThrow(BadRequestException);
    });
  });

  describe("resetPassword", () => {
    it("updates the password, marks the token as used and revokes all sessions", async () => {
      resetRepository.findOne.mockResolvedValue({
        id: "reset-1",
        token: "valid-token",
        userId: "user-1",
        used: false,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await service.resetPassword("valid-token", "new-password");

      expect(usersService.update).toHaveBeenCalledWith("user-1", { password: "new-password" });
      expect(resetRepository.save).toHaveBeenCalledWith(expect.objectContaining({ used: true }));
      expect(refreshRepository.update).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }), { revokedAt: expect.any(Date) });
    });

    it("rejects an unknown token with Unauthorized", async () => {
      resetRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword("bad-token", "pw")).rejects.toThrow(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it("rejects an expired token with Unauthorized", async () => {
      resetRepository.findOne.mockResolvedValue({
        id: "reset-1",
        used: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword("expired-token", "pw")).rejects.toThrow(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it("rejects an already-used token with Unauthorized", async () => {
      resetRepository.findOne.mockResolvedValue({
        id: "reset-1",
        used: true,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await expect(service.resetPassword("used-token", "pw")).rejects.toThrow(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });
  });
});
