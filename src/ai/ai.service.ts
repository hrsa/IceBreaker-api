import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { CategoriesService } from "../categories/categories.service";
import { CardsService } from "../cards/cards.service";
import { AppLanguage } from "src/common/constants/app-language.enum";
import { GameGenerationStoreService } from "./game-generation-store.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { GameGenerationCompletedEvent } from "./events/game-generation-completed.event";

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
    const systemPromptTemplate = Buffer.from(
      this.configService.getOrThrow<string>("TRANSLATOR_SYSTEM_PROMPT"),
      "base64"
    ).toString("ascii");

    const systemPrompt = systemPromptTemplate.replace("{{LANGUAGE}}", targetLanguage);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
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
      return response!.choices[0]!.message!.content!.trim();
    } catch (error) {
      this.logger.error(`Translation error: ${error.message}`, error.stack);
      throw new Error(`Failed to translate text: ${error.message}`);
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
    const systemPrompt = Buffer.from(
      this.configService.getOrThrow<string>("GAME_GENERATION_PROMPT"),
      "base64"
    ).toString("ascii");

    let prompt = systemPrompt + cardsData;
    try {
      const response = await this.openai.beta.chat.completions.parse({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: description },
        ],
        response_format: zodResponseFormat(Game, "game"),
      });
      this.logger.log(`Generated game: ${response.choices[0].message.parsed}`);
      return response.choices[0].message.parsed;
    } catch (e) {
      throw new Error(e.message);
    }
  }

  async createCustomGame(description: string, userId: string) {
    const requestId = await this.gameGenerationStore.createTask(userId, description);

    this.generateGame(requestId, description, userId);

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
        this.logger.error(`Failed to generate new game for ${requestId}: ${generationData}`);
        await this.gameGenerationStore.updateTaskStatus(requestId, "failed", {
          generationData: JSON.stringify(generationData),
          error: "Failed to generate new game",
        });
        return;
      }

      const category = await this.categoriesService.create(
        {
          name: generationData.name_en,
          description: generationData.description_en,
          language: AppLanguage.ENGLISH,
          isPublic: false,
        },
        userId
      );
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
