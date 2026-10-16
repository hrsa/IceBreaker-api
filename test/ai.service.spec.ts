import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OpenAIRealtimeWebSocket } from "openai/realtime/websocket";
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

jest.mock("node:child_process", () => {
  const actual = jest.requireActual("node:child_process");
  return { ...actual, execFile: jest.fn() };
});

jest.mock("openai/realtime/websocket", () => ({
  OpenAIRealtimeWebSocket: jest.fn(),
}));

const fsMock = fs as unknown as {
  writeFileSync: jest.Mock;
  readFileSync: jest.Mock;
  rmSync: jest.Mock;
  existsSync: jest.Mock;
};
const execFileMock = execFile as unknown as jest.Mock;
const realtimeConstructorMock = OpenAIRealtimeWebSocket as unknown as jest.Mock;

class FakeRealtimeSocket extends EventEmitter {
  send = jest.fn();
  close = jest.fn();
}

async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe("AIService", () => {
  let service: AIService;
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let openaiMock: {
    chat: { completions: { create: jest.Mock; parse: jest.Mock } };
    audio: { speech: { create: jest.Mock } };
  };
  let realtimeSocket: FakeRealtimeSocket;
  let ttsProvider: string | undefined;

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

    ttsProvider = undefined;
    configService = {
      get: jest.fn((key: string) => {
        if (key === "OPENAI_API_KEY") return "test-key";
        if (key === "AI_TTS_PROVIDER") return ttsProvider;
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === "GREETING_PROMPT") return Buffer.from("Greet {{NAME}} in {{LANGUAGE}}").toString("base64");
        if (key === "HELLO_GENERATION_PROMPT") return Buffer.from("Say hello to {{NAME}}").toString("base64");
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

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
          parse: jest.fn(),
        },
      },
      audio: { speech: { create: jest.fn() } },
    };
    (service as any).openai = openaiMock;

    realtimeConstructorMock.mockImplementation(() => {
      realtimeSocket = new FakeRealtimeSocket();
      return realtimeSocket;
    });

    execFileMock.mockImplementation(
      (command: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        mockFsStore.set(args[args.length - 1], FAKE_OGG);
        callback(null, "", "");
      }
    );
  });

  function emitSessionCreated() {
    realtimeSocket.emit("session.created", { type: "session.created", event_id: "evt_1", session: {} });
  }

  function emitAudioDelta(pcm: string) {
    realtimeSocket.emit("response.output_audio.delta", {
      type: "response.output_audio.delta",
      event_id: "evt_delta",
      item_id: "item_1",
      response_id: "resp_1",
      output_index: 0,
      content_index: 0,
      delta: Buffer.from(pcm).toString("base64"),
    });
  }

  function emitResponseDone(status = "completed") {
    realtimeSocket.emit("response.done", {
      type: "response.done",
      event_id: "evt_done",
      response: { status },
    });
  }

  describe("sayHello (realtime provider)", () => {
    it("synthesizes the greeting over a realtime session and writes an ogg file", async () => {
      const promise = service.sayHello("Anton", AppLanguage.ENGLISH);

      await flushMicrotasks();
      expect(realtimeConstructorMock).toHaveBeenCalledWith({ model: "gpt-realtime-2.1-mini" }, expect.anything());

      emitSessionCreated();

      expect(realtimeSocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session.update",
          session: expect.objectContaining({
            instructions: "Say hello to Anton",
            output_modalities: ["audio"],
            audio: { output: { voice: "sage", format: { type: "audio/pcm", rate: 24000 } } },
          }),
        })
      );
      expect(realtimeSocket.send).toHaveBeenCalledWith({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: GREETING_TEXT }],
        },
      });
      expect(realtimeSocket.send).toHaveBeenCalledWith({ type: "response.create" });

      emitAudioDelta("pcm-chunk-1");
      emitAudioDelta("pcm-chunk-2");
      emitResponseDone();

      const filePath = await promise;

      expect(realtimeSocket.close).toHaveBeenCalledTimes(1);
      expect(filePath).toMatch(/^\/app\/storage\/Hello-Anton-\d+\.ogg$/);
      expect(fsMock.existsSync(filePath)).toBe(true);
      expect(fsMock.readFileSync(filePath)).toEqual(FAKE_OGG);

      const pcmWrite = fsMock.writeFileSync.mock.calls.find(([p]) => String(p).endsWith(".pcm"));
      expect(pcmWrite[1]).toEqual(Buffer.concat([Buffer.from("pcm-chunk-1"), Buffer.from("pcm-chunk-2")]));
      expect(execFileMock).toHaveBeenCalledWith(
        "ffmpeg",
        expect.arrayContaining(["-f", "s16le", "-ar", "24000", "-ac", "1", "-c:a", "libopus"]),
        expect.any(Function)
      );
      expect(fsMock.rmSync).toHaveBeenCalledWith(pcmWrite[0], { force: true });
    });

    it("rejects with GreetingSynthesisError and closes the socket when the realtime session errors", async () => {
      const promise = service.sayHello("Anton", AppLanguage.ENGLISH);

      await flushMicrotasks();
      realtimeSocket.emit("error", new Error("connection reset"));

      const error = await promise.catch(e => e);
      expect(error).toBeInstanceOf(GreetingSynthesisError);
      expect(error.greetingText).toBe(GREETING_TEXT);
      expect(error.message).toContain("connection reset");
      expect(realtimeSocket.close).toHaveBeenCalledTimes(1);
      expect(fsMock.writeFileSync).not.toHaveBeenCalledWith(expect.stringMatching(/^\/app\/storage\//), expect.anything());
    });

    it("rejects after 30 seconds when no response.done arrives", async () => {
      jest.useFakeTimers();
      try {
        const promise = service.sayHello("Anton", AppLanguage.ENGLISH);
        const assertion = expect(promise).rejects.toThrow(/timed out/);

        await flushMicrotasks();
        emitSessionCreated();
        await jest.advanceTimersByTimeAsync(30_000);

        await assertion;
        expect(realtimeSocket.close).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it("rejects when the realtime response finishes with a failed status", async () => {
      const promise = service.sayHello("Anton", AppLanguage.ENGLISH);

      await flushMicrotasks();
      emitSessionCreated();
      emitResponseDone("failed");

      const error = await promise.catch(e => e);
      expect(error).toBeInstanceOf(GreetingSynthesisError);
      expect(error.message).toContain("failed");
      expect(realtimeSocket.close).toHaveBeenCalledTimes(1);
    });

    it("rejects when ffmpeg fails to encode the pcm audio", async () => {
      execFileMock.mockImplementation((command: string, args: string[], callback: (error: Error | null) => void) => {
        callback(new Error("ffmpeg exited with code 1"));
      });

      const promise = service.sayHello("Anton", AppLanguage.ENGLISH);
      await flushMicrotasks();
      emitSessionCreated();
      emitResponseDone();

      const error = await promise.catch(e => e);
      expect(error).toBeInstanceOf(GreetingSynthesisError);
      expect(error.message).toContain("ffmpeg");
      expect(realtimeSocket.close).toHaveBeenCalledTimes(1);
    });

    it("uses the hardcoded greeting text when the model returns no greeting", async () => {
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: null } }] });

      const promise = service.sayHello("Anton", AppLanguage.RUSSIAN);
      await flushMicrotasks();
      emitSessionCreated();
      emitResponseDone();

      await promise;
      expect(realtimeSocket.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "conversation.item.create",
          item: expect.objectContaining({
            content: [{ type: "input_text", text: "Привет, Anton! Как давно мы не играли!" }],
          }),
        })
      );
    });
  });

  describe("sayHello (legacy speech-api provider)", () => {
    it("uses the legacy speech API when AI_TTS_PROVIDER=speech-api", async () => {
      ttsProvider = "speech-api";
      const legacyAudio = new TextEncoder().encode("legacy-mp3-bytes");
      openaiMock.audio.speech.create.mockResolvedValue({ arrayBuffer: () => Promise.resolve(legacyAudio.buffer) });

      const filePath = await service.sayHello("Anton", AppLanguage.ENGLISH);

      expect(openaiMock.audio.speech.create).toHaveBeenCalledWith({
        model: "gpt-4o-mini-tts",
        voice: "sage",
        input: GREETING_TEXT,
        instructions: "Say hello to Anton",
      });
      expect(realtimeConstructorMock).not.toHaveBeenCalled();
      expect(execFileMock).not.toHaveBeenCalled();
      expect(fsMock.readFileSync(filePath)).toEqual(Buffer.from("legacy-mp3-bytes"));
    });
  });
});
