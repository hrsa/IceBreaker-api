import * as fs from "node:fs";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AIService, GreetingSynthesisError } from "../src/ai/ai.service";
import { AppLanguage } from "../src/common/constants/app-language.enum";

const GREETING_TEXT = "Hello, Anton! It's been so long since we played!";
const FAKE_OGG = Buffer.from("fake-ogg-opus-data");

const mockFsStore = new Map<string, Buffer>();

jest.mock("node:fs", () => {
  const actual = jest.requireActual("node:fs");
  return {
    ...actual,
    writeFileSync: jest.fn(actual.writeFileSync),
    readFileSync: jest.fn(actual.readFileSync),
    rmSync: jest.fn(actual.rmSync),
    existsSync: jest.fn(actual.existsSync),
  };
});

const fsMock = fs as unknown as {
  writeFileSync: jest.Mock;
  readFileSync: jest.Mock;
  rmSync: jest.Mock;
  existsSync: jest.Mock;
};

describe("AIService", () => {
  let service: AIService;
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let openaiMock: {
    chat: { completions: { create: jest.Mock } };
  };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    mockFsStore.clear();
    jest.clearAllMocks();

    fsMock.writeFileSync.mockImplementation((filePath: string, data: Buffer) => {
      mockFsStore.set(filePath, data);
    });
    fsMock.readFileSync.mockImplementation((filePath: string) => mockFsStore.get(filePath));
    fsMock.rmSync.mockImplementation((filePath: string) => {
      mockFsStore.delete(filePath);
    });
    fsMock.existsSync.mockImplementation((filePath: string) => mockFsStore.has(filePath));

    configService = {
      get: jest.fn((key: string) => {
        if (key === "MISTRAL_API_KEY") return "test-key";
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === "GREETING_PROMPT") return Buffer.from("Greet {{NAME}} in {{LANGUAGE}}").toString("base64");
        if (key === "TRANSLATION_PROMPT") return Buffer.from("Translate into {{LANGUAGE}}").toString("base64");
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audio_data: FAKE_OGG.toString("base64") }),
    });
    (globalThis as any).fetch = fetchMock;

    service = new AIService(
      configService as unknown as ConfigService,
      {} as any,
      {} as any,
      {} as any,
      { emit: jest.fn() } as unknown as EventEmitter2
    );

    openaiMock = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({ choices: [{ message: { content: GREETING_TEXT } }] }),
        },
      },
    };
    (service as any).openai = openaiMock;
  });

  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  describe("sayHello", () => {
    it("synthesizes the greeting via Mistral speech API and writes an ogg file", async () => {
      const filePath = await service.sayHello("Anton", AppLanguage.ENGLISH);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.mistral.ai/v1/audio/speech");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer test-key");
      const body = JSON.parse(init.body);
      expect(body).toEqual({
        model: "voxtral-mini-tts-3-0",
        input: `[emotion=happy] ${GREETING_TEXT}`,
        voice_id: "en_paul_happy",
        response_format: "opus",
      });

      expect(filePath).toMatch(/^\/app\/storage\/Hello-Anton-\d+\.ogg$/);
      expect(fsMock.existsSync(filePath)).toBe(true);
      expect(fsMock.readFileSync(filePath)).toEqual(FAKE_OGG);
    });

    it("uses the per-language voice for the greeting language", async () => {
      await service.sayHello("Anton", AppLanguage.RUSSIAN);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.voice_id).toBe("voice_3132");
    });

    it("honours AI_TTS_VOICE_* and AI_TTS_MODEL overrides", async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "MISTRAL_API_KEY") return "test-key";
        if (key === "AI_TTS_VOICE_EN") return "voice_478";
        if (key === "AI_TTS_MODEL") return "voxtral-mini-tts-custom";
        if (key === "AI_TTS_STYLE_TAG") return "";
        return undefined;
      });

      await service.sayHello("Anton", AppLanguage.ENGLISH);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.voice_id).toBe("voice_478");
      expect(body.model).toBe("voxtral-mini-tts-custom");
      expect(body.input).toBe(GREETING_TEXT);
    });

    it("rejects with GreetingSynthesisError when the speech API returns an error status", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"message":"bad voice"}'),
      });

      const error = await service.sayHello("Anton", AppLanguage.ENGLISH).catch(e => e);
      expect(error).toBeInstanceOf(GreetingSynthesisError);
      expect(error.greetingText).toBe(GREETING_TEXT);
      expect(error.message).toContain("400");
      expect(fsMock.writeFileSync).not.toHaveBeenCalledWith(expect.stringMatching(/^\/app\/storage\//), expect.anything());
    });

    it("rejects with GreetingSynthesisError when fetch throws", async () => {
      fetchMock.mockRejectedValue(new Error("connection reset"));

      const error = await service.sayHello("Anton", AppLanguage.ENGLISH).catch(e => e);
      expect(error).toBeInstanceOf(GreetingSynthesisError);
      expect(error.message).toContain("connection reset");
    });

    it("rejects when the speech response has no audio_data", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

      const error = await service.sayHello("Anton", AppLanguage.ENGLISH).catch(e => e);
      expect(error).toBeInstanceOf(GreetingSynthesisError);
      expect(error.message).toContain("audio_data");
    });

    it("strips markdown and emoji from the greeting before synthesis", async () => {
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: "**Hello**, *Anton*! 🌟\nHow are you?" } }] });

      await service.sayHello("Anton", AppLanguage.ENGLISH);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.input).toBe("[emotion=happy] Hello, Anton! How are you?");
    });

    it("uses the hardcoded greeting text when the model returns no greeting", async () => {
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: null } }] });

      await service.sayHello("Anton", AppLanguage.RUSSIAN);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.input).toContain("Привет, Anton! Как давно мы не играли!");
    });
  });

  describe("translateText", () => {
    it("calls the translation model without OpenAI-only params", async () => {
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: "Bonjour" } }] });

      const result = await service.translateText("Hello", "French");

      expect(result).toBe("Bonjour");
      const call = openaiMock.chat.completions.create.mock.calls[0][0];
      expect(call.model).toBe("mistral-medium-latest");
      expect(call).not.toHaveProperty("reasoning_effort");
      expect(call.messages[0]).toEqual({ role: "system", content: "Translate into French" });
      expect(call.messages[1]).toEqual({ role: "user", content: "Hello" });
    });

    it("honours AI_TRANSLATION_MODEL override", async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "MISTRAL_API_KEY") return "test-key";
        if (key === "AI_TRANSLATION_MODEL") return "mistral-medium-latest";
        return undefined;
      });
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: "Bonjour" } }] });

      await service.translateText("Hello", "French");

      expect(openaiMock.chat.completions.create.mock.calls[0][0].model).toBe("mistral-medium-latest");
    });
  });

  describe("getGreeting", () => {
    it("uses the greeting model and substitutes name and language", async () => {
      await service.getGreeting("Anton", AppLanguage.FRENCH);

      const call = openaiMock.chat.completions.create.mock.calls[0][0];
      expect(call.model).toBe("mistral-small-2603");
      expect(call.messages[0].content).toBe("Greet Anton in French");
    });
  });
});
