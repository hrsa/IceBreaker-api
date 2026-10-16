import * as fs from "node:fs";
import { Context } from "telegraf";
import { TelegramService } from "../src/telegram/telegram.service";
import { GreetingSynthesisError } from "../src/ai/ai.service";
import { AppLanguage } from "../src/common/constants/app-language.enum";

const mockFsStore = new Map<string, Buffer>();

jest.mock("node:fs", () => {
  const actual = jest.requireActual("node:fs");
  return {
    ...actual,
    createReadStream: jest.fn(actual.createReadStream),
    existsSync: jest.fn(actual.existsSync),
    unlinkSync: jest.fn(actual.unlinkSync),
  };
});

const fsMock = fs as unknown as {
  createReadStream: jest.Mock;
  existsSync: jest.Mock;
  unlinkSync: jest.Mock;
};

describe("TelegramService", () => {
  let service: TelegramService;
  let bot: { telegram: { sendVoice: jest.Mock; deleteMessage: jest.Mock } };
  let usersService: { findByTelegramId: jest.Mock };
  let aiService: { sayHello: jest.Mock };
  let translate: { t: jest.Mock };
  let session: { language: AppLanguage; botMessageIds?: number[] };
  let ctx: Context;

  const helloFilePath = "/app/storage/Hello-Anton-123456.ogg";

  beforeEach(() => {
    mockFsStore.clear();
    jest.clearAllMocks();

    fsMock.createReadStream.mockImplementation((filePath: string) => ({ path: filePath }));
    fsMock.existsSync.mockImplementation((filePath: string) => mockFsStore.has(filePath));
    fsMock.unlinkSync.mockImplementation((filePath: string) => {
      mockFsStore.delete(filePath);
    });

    bot = {
      telegram: {
        sendVoice: jest.fn().mockResolvedValue({ message_id: 42 }),
        deleteMessage: jest.fn().mockResolvedValue(true),
      },
    };
    usersService = { findByTelegramId: jest.fn().mockResolvedValue({ id: "user-1", name: "Anton" }) };
    aiService = { sayHello: jest.fn() };
    translate = { t: jest.fn().mockReturnValue("translated greeting failed message") };

    service = new TelegramService(
      bot as any,
      { add: jest.fn() } as any,
      { get: jest.fn(), getOrThrow: jest.fn() } as any,
      {} as any,
      { subscribe: jest.fn() } as any,
      usersService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      aiService as any,
      translate as any
    );

    session = { language: AppLanguage.ENGLISH };
    ctx = {
      chat: { id: 123 },
      message: { chat: { id: 123 }, message_id: 7 },
      session,
      reply: jest.fn().mockResolvedValue({ message_id: 99 }),
    } as unknown as Context;
  });

  describe("sayHello", () => {
    it("sends the synthesized greeting as a voice message and removes the file", async () => {
      aiService.sayHello.mockResolvedValue(helloFilePath);
      mockFsStore.set(helloFilePath, Buffer.from("ogg"));

      await service.sayHello(ctx);

      expect(aiService.sayHello).toHaveBeenCalledWith("Anton", AppLanguage.ENGLISH);
      expect(fsMock.createReadStream).toHaveBeenCalledWith(helloFilePath);
      expect(bot.telegram.sendVoice).toHaveBeenCalledWith(123, { source: { path: helloFilePath } });
      expect(session.botMessageIds).toEqual([42]);
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(helloFilePath);
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it("replies with the greeting text when audio synthesis fails", async () => {
      aiService.sayHello.mockRejectedValue(new GreetingSynthesisError("realtime exploded", "Hello, Anton!"));

      await service.sayHello(ctx);

      expect(ctx.reply).toHaveBeenCalledWith("Hello, Anton!");
      expect(bot.telegram.sendVoice).not.toHaveBeenCalled();
      expect(fsMock.unlinkSync).not.toHaveBeenCalled();
    });

    it("replies with a localized error when the failure carries no greeting text", async () => {
      aiService.sayHello.mockRejectedValue(new Error("openai is down"));

      await service.sayHello(ctx);

      expect(translate.t).toHaveBeenCalledWith("telegram.errors.greeting_failed", { lang: AppLanguage.ENGLISH });
      expect(ctx.reply).toHaveBeenCalledWith("translated greeting failed message");
      expect(bot.telegram.sendVoice).not.toHaveBeenCalled();
    });

    it("cleans up the audio file when sending the voice message fails", async () => {
      aiService.sayHello.mockResolvedValue(helloFilePath);
      mockFsStore.set(helloFilePath, Buffer.from("ogg"));
      bot.telegram.sendVoice.mockRejectedValue(new Error("telegram api error"));

      await service.sayHello(ctx);

      expect(fsMock.unlinkSync).toHaveBeenCalledWith(helloFilePath);
      expect(ctx.reply).toHaveBeenCalledWith("translated greeting failed message");
    });
  });
});
