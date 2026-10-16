import { Injectable, Logger } from "@nestjs/common";
import { getErrorMessage, getErrorStack } from "../common/utils/error.utils";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { CategoriesService } from "../categories/categories.service";
import { CardsService } from "../cards/cards.service";
import { AppLanguage, languageMap } from "../common/constants/app-language.enum";
import { GameGenerationStoreService } from "./game-generation-store.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { GameGenerationCompletedEvent } from "./events/game-generation-completed.event";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { OpenAIRealtimeWebSocket } from "openai/realtime/websocket";

const execFileAsync = promisify(execFile);

export class GreetingSynthesisError extends Error {
  constructor(
    message: string,
    public readonly greetingText: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "GreetingSynthesisError";
  }
}

@Injectable()
export class AIService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gameGenerationStore: GameGenerationStoreService,
    private readonly categoriesService: CategoriesService,
    private readonly cardsService: CardsService,
    private eventEmitter: EventEmitter2
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>("OPENAI_API_KEY"),
    });
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    const systemPromptTemplate = Buffer.from(this.configService.getOrThrow<string>("TRANSLATION_PROMPT"), "base64").toString("ascii");

    const systemPrompt = systemPromptTemplate.replace("{{LANGUAGE}}", targetLanguage);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-6-luna",
        reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      });
      return response.choices[0].message.content!.trim();
    } catch (error) {
      this.logger.error(`Translation error: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new Error(`Failed to translate text: ${getErrorMessage(error)}`, { cause: error });
    }
  }

  async getGreeting(name: string, language: AppLanguage) {
    const promptTemplate = Buffer.from(this.configService.getOrThrow<string>("GREETING_PROMPT"), "base64").toString("ascii");

    let prompt = promptTemplate.replace("{{NAME}}", name);
    prompt = prompt.replace("{{LANGUAGE}}", languageMap[language]);

    const response = await this.openai.chat.completions.create({
      model: "gpt-6.1-sol",
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });
    return response.choices[0].message.content;
  }

  async sayHello(name: string, language: AppLanguage): Promise<string> {
    let input = await this.getGreeting(name, language);

    if (!input) {
      switch (language) {
        case AppLanguage.ENGLISH:
          input = `Hello, ${name}! It's been so long since we played!`;
          break;
        case AppLanguage.FRENCH:
          input = `Salut, ${name}! Cela faisait si longtemps qu'on n'avait pas joué !`;
          break;
        case AppLanguage.ITALIAN:
          input = `Ciao, ${name}! È passato così tanto tempo da quando abbiamo giocato!`;
          break;
        default:
          input = `Привет, ${name}! Как давно мы не играли!`;
          break;
      }
    }

    let instructions = Buffer.from(this.configService.getOrThrow<string>("HELLO_GENERATION_PROMPT"), "base64").toString("ascii");
    instructions = instructions.replace("{{NAME}}", name);

    try {
      const provider = this.configService.get<string>("AI_TTS_PROVIDER") ?? "realtime";
      const audioBuffer =
        provider === "speech-api"
          ? await this.synthesizeSpeechLegacy(input, instructions)
          : await this.synthesizeSpeech(input, instructions);

      const filename = `Hello-${name}-${Date.now()}.ogg`;
      const tempFilePath = path.join(`/app/storage/${filename}`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      return tempFilePath;
    } catch (error) {
      throw new GreetingSynthesisError(`Failed to synthesize greeting audio for ${name}: ${getErrorMessage(error)}`, input, {
        cause: error,
      });
    }
  }

  private async synthesizeSpeechLegacy(input: string, instructions: string): Promise<Buffer> {
    const response = await this.openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "sage",
      input,
      instructions,
    });
    return Buffer.from(await response.arrayBuffer());
  }

  private async synthesizeSpeech(text: string, instructions: string): Promise<Buffer> {
    const socket = new OpenAIRealtimeWebSocket({ model: "gpt-realtime-2.1-mini" }, this.openai);
    try {
      const pcm = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const timeout = setTimeout(() => {
          reject(new Error("Realtime TTS synthesis timed out after 30 seconds"));
        }, 30_000);

        socket.on("error", error => {
          clearTimeout(timeout);
          reject(error);
        });

        socket.on("session.created", () => {
          socket.send({
            type: "session.update",
            session: {
              type: "realtime",
              instructions,
              output_modalities: ["audio"],
              audio: {
                output: {
                  voice: "sage",
                  format: { type: "audio/pcm", rate: 24000 },
                },
              },
            },
          });
          socket.send({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text }],
            },
          });
          socket.send({ type: "response.create" });
        });

        socket.on("response.output_audio.delta", event => {
          chunks.push(Buffer.from(event.delta, "base64"));
        });

        socket.on("response.done", event => {
          clearTimeout(timeout);
          if (event.response.status && event.response.status !== "completed") {
            reject(new Error(`Realtime TTS response finished with status: ${event.response.status}`));
            return;
          }
          resolve(Buffer.concat(chunks));
        });
      });
      return await this.encodePcmToOgg(pcm);
    } finally {
      socket.close();
    }
  }

  private async encodePcmToOgg(pcm: Buffer): Promise<Buffer> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const pcmPath = path.join(os.tmpdir(), `hello-${id}.pcm`);
    const oggPath = path.join(os.tmpdir(), `hello-${id}.ogg`);
    try {
      fs.writeFileSync(pcmPath, pcm);
      await execFileAsync("ffmpeg", ["-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", pcmPath, "-c:a", "libopus", oggPath]);
      return fs.readFileSync(oggPath);
    } finally {
      fs.rmSync(pcmPath, { force: true });
      fs.rmSync(oggPath, { force: true });
    }
  }

  private async generateNewGameData(description: string, cardsData: string) {
    const Game = z.object({
      name_en: z.string(),
      description_en: z.string(),
      cards: z.array(
        z.object({
          question_en: z.string(),
        })
      ),
    });
    const systemPrompt = Buffer.from(this.configService.getOrThrow<string>("GAME_GENERATION_PROMPT"), "base64").toString("ascii");

    const prompt = systemPrompt + cardsData;
    try {
      const response = await this.openai.chat.completions.parse({
        model: "gpt-6.1-sol",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: description },
        ],
        response_format: zodResponseFormat(Game, "game"),
      });
      this.logger.log(`Generated game: ${JSON.stringify(response.choices[0].message.parsed)}`);
      return response.choices[0].message.parsed;
    } catch (e) {
      throw new Error(getErrorMessage(e), { cause: e });
    }
  }

  async createCustomGame(description: string, userId: string) {
    const requestId = await this.gameGenerationStore.createTask(userId, description);

    void this.generateGame(requestId, description, userId);

    return {
      requestId,
      status: "processing",
      message: "Game generation started. Check status in half a minute.",
    };
  }

  private async generateGame(requestId: string, description: string, userId: string) {
    try {
      const randomCards = await this.cardsService.getRandomCardForGeneration(10);
      const cardsData = randomCards.map(card => card.question_en);
      const generationData = await this.generateNewGameData(description, JSON.stringify(cardsData));

      if (
        !generationData ||
        !generationData.cards ||
        generationData.cards.length === 0 ||
        !generationData.name_en ||
        !generationData.description_en
      ) {
        this.logger.error(`Failed to generate new game for ${requestId}: ${JSON.stringify(generationData)}`);
        await this.gameGenerationStore.updateTaskStatus(requestId, "failed", {
          generationData: JSON.stringify(generationData),
          error: "Failed to generate new game",
        });
        return;
      }

      const category = await this.categoriesService.create({
        name: generationData.name_en,
        description: generationData.description_en,
        language: AppLanguage.ENGLISH,
        isPublic: false,
      });
      for (const cardData of generationData.cards) {
        await this.cardsService.create({
          question: cardData.question_en,
          language: AppLanguage.ENGLISH,
          categoryId: category.id,
        });
        //set a 5-second delay between cards to let translations finish
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      await this.gameGenerationStore.updateTaskStatus(requestId, "completed", {
        categoryId: category.id,
        generationData: JSON.stringify(generationData),
        gameName: generationData.name_en,
        cardsCount: generationData.cards.length,
      });

      await this.categoriesService.setUserId(category.id, userId);

      this.eventEmitter.emit("game.generation.completed", new GameGenerationCompletedEvent(userId, category.id));

      this.logger.log(`Game generation completed for request ${requestId}`);
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Error in background game generation for request ${requestId}: ${error.message}`, error.stack);
      await this.gameGenerationStore.updateTaskStatus(requestId, "failed", {
        error: error.message,
      });
    }
  }
}
