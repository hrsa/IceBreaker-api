import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AuthService } from "../src/auth/auth.service";
import { PasswordReset } from "../src/auth/entities/password-reset.entity";
import { UsersService } from "../src/users/users.service";

describe("AuthService", () => {
  let service: AuthService;
  let resetRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let usersService: { findByEmail: jest.Mock; update: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    resetRepository = {
      create: jest.fn().mockImplementation(dto => dto),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
    };
    usersService = { findByEmail: jest.fn(), update: jest.fn().mockResolvedValue({}) };
    jwtService = { sign: jest.fn().mockReturnValue("signed-token") };
    configService = {
      get: jest.fn().mockReturnValue("secret"),
      getOrThrow: jest.fn().mockReturnValue("secret"),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(PasswordReset), useValue: resetRepository },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("login", () => {
    it("signs a jwt with the user id and email", async () => {
      const result = await service.login({ id: "user-1", email: "user@test.net" } as any);

      expect(jwtService.sign).toHaveBeenCalledWith({ sub: "user-1", email: "user@test.net" });
      expect(result.accessToken).toBe("signed-token");
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
      // Regression: findByEmail throws NotFoundException, which used to
      // propagate and reveal which emails are registered.
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
    it("updates the password and marks the token as used", async () => {
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
