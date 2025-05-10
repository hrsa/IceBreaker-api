import { Injectable, Logger } from "@nestjs/common";
import { RedisSessionService } from "../redis/redis-session.middleware";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export interface GameGenerationTask {
  requestId: string;
  userId: string;
  status: "processing" | "completed" | "failed";
  generationData?: string;
  description: string;
  categoryId?: string;
  gameName?: string;
  cardsCount?: number;
  error?: string;
  createdAt: number;
}

@Injectable()
export class GameGenerationStoreService {
  private readonly logger = new Logger(GameGenerationStoreService.name);
  private readonly keyPrefix = "game_generation:";
  private readonly ttl: number;
  private readonly redis: Redis;

  constructor(
    private readonly redisSessionService: RedisSessionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService
  ) {
    this.ttl = this.configService.get<number>("REDIS_TTL", 60 * 60 * 24);
    this.redis = this.redisSessionService.getRedisClient();
  }

  private getKey(requestId: string): string {
    return `${this.keyPrefix}${requestId}`;
  }

  async createTask(userId: string, description: string): Promise<string> {
    const requestId = crypto.randomUUID();

    const task: GameGenerationTask = {
      requestId,
      userId,
      status: "processing",
      description,
      createdAt: Date.now(),
    };

    await this.redis.set(this.getKey(requestId), JSON.stringify(task), "EX", this.ttl);

    return requestId;
  }

  async getTask(requestId: string): Promise<GameGenerationTask | null> {
    const redis = this.redisSessionService.getRedisClient();
    const taskJson = await redis.get(this.getKey(requestId));

    if (!taskJson) {
      return null;
    }

    return JSON.parse(taskJson) as GameGenerationTask;
  }

  async updateTaskStatus(
    requestId: string,
    status: "completed" | "failed",
    data?: {
      categoryId?: string;
      gameName?: string;
      generationData?: string | undefined;
      cardsCount?: number;
      error?: string;
    }
  ): Promise<void> {
    const task = await this.getTask(requestId);
    if (!task) {
      this.logger.error(`Task not found: ${requestId}`);
      return;
    }

    const updatedTask: GameGenerationTask = {
      ...task,
      status,
      ...data,
    };

    await this.redis.set(this.getKey(requestId), JSON.stringify(updatedTask), "EX", this.ttl);

    if (status === "completed") {
      this.eventEmitter.emit("game.generation.completed", updatedTask);
    } else if (status === "failed") {
      this.eventEmitter.emit("game.generation.failed", updatedTask);
    }
  }

  async getTasksByUserId(userId: string): Promise<GameGenerationTask[]> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);

    if (keys.length === 0) {
      return [];
    }

    const tasks: GameGenerationTask[] = [];

    for (const key of keys) {
      const taskJson = await this.redis.get(key);
      if (taskJson) {
        const task = JSON.parse(taskJson) as GameGenerationTask;
        if (task.userId === userId) {
          tasks.push(task);
        }
      }
    }

    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  async cleanupOldTasks(olderThanHours = 72): Promise<number> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);

    if (keys.length === 0) {
      return 0;
    }

    const now = Date.now();
    const cutoffTime = now - olderThanHours * 60 * 60 * 1000;
    let deleted = 0;

    for (const key of keys) {
      const taskJson = await this.redis.get(key);
      if (taskJson) {
        const task = JSON.parse(taskJson) as GameGenerationTask;
        if (task.createdAt < cutoffTime) {
          await this.redis.del(key);
          deleted++;
        }
      }
    }

    return deleted;
  }
}
