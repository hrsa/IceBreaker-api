import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import { GameGenerationStoreService } from "../src/ai/game-generation-store.service";
import { RedisSessionService } from "../src/redis-session/redis-session.middleware";

describe("GameGenerationStoreService", () => {
  let service: GameGenerationStoreService;
  let redis: { set: jest.Mock; get: jest.Mock; keys: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    redis = {
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    };
    eventEmitter = { emit: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(3600) };

    const redisSessionService = {
      getRedisClient: jest.fn().mockReturnValue(redis),
    } as unknown as jest.Mocked<RedisSessionService>;

    service = new GameGenerationStoreService(
      redisSessionService,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService
    );
  });

  describe("createTask", () => {
    it("stores the task with a TTL and returns a request id", async () => {
      const requestId = await service.createTask("user-1", "space travel game");

      expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(redis.set).toHaveBeenCalledWith(`game_generation:${requestId}`, expect.any(String), "EX", 3600);

      const stored = JSON.parse(redis.set.mock.calls[0][1]);
      expect(stored).toMatchObject({
        userId: "user-1",
        description: "space travel game",
        status: "processing",
      });
    });

    it("stores distinct request ids for separate tasks", async () => {
      const first = await service.createTask("user-1", "a");
      const second = await service.createTask("user-1", "b");

      expect(first).not.toBe(second);
    });
  });

  describe("getTask", () => {
    it("returns null for an unknown request id", async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.getTask("missing")).resolves.toBeNull();
    });

    it("parses the stored JSON back into a task", async () => {
      redis.get.mockResolvedValue(JSON.stringify({ requestId: "r1", userId: "user-1", status: "processing" }));

      const task = await service.getTask("r1");

      expect(task).toMatchObject({ requestId: "r1", userId: "user-1", status: "processing" });
    });
  });

  describe("updateTaskStatus", () => {
    it("marks a task completed, persists it and emits the event", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          requestId: "r1",
          userId: "user-1",
          status: "processing",
          createdAt: 1,
        })
      );

      await service.updateTaskStatus("r1", "completed", { categoryId: "cat-1", cardsCount: 45 });

      const stored = JSON.parse(redis.set.mock.calls[0][1]);
      expect(stored).toMatchObject({
        status: "completed",
        categoryId: "cat-1",
        cardsCount: 45,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith("game.generation.completed", expect.anything());
    });

    it("emits the failure event when a task fails", async () => {
      redis.get.mockResolvedValue(JSON.stringify({ requestId: "r1", userId: "user-1", status: "processing", createdAt: 1 }));

      await service.updateTaskStatus("r1", "failed", { error: "generation failed" });

      expect(eventEmitter.emit).toHaveBeenCalledWith("game.generation.failed", expect.anything());
      const stored = JSON.parse(redis.set.mock.calls[0][1]);
      expect(stored.error).toBe("generation failed");
    });

    it("does nothing for an unknown request id", async () => {
      // The service logs an error for unknown tasks; spy on the logger to
      // keep the test output clean and assert the log line.
      const loggerError = jest.spyOn((service as any).logger, "error").mockImplementation(jest.fn());
      redis.get.mockResolvedValue(null);

      await service.updateTaskStatus("missing", "completed");

      expect(loggerError).toHaveBeenCalledWith("Task not found: missing");
      expect(redis.set).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe("getTasksByUserId", () => {
    it("returns an empty list when no tasks exist", async () => {
      redis.keys.mockResolvedValue([]);

      await expect(service.getTasksByUserId("user-1")).resolves.toEqual([]);
    });

    it("returns only the user's tasks, newest first", async () => {
      redis.keys.mockResolvedValue(["game_generation:a", "game_generation:b", "game_generation:c"]);
      redis.get
        .mockResolvedValueOnce(JSON.stringify({ requestId: "a", userId: "user-1", createdAt: 100 }))
        .mockResolvedValueOnce(JSON.stringify({ requestId: "b", userId: "user-2", createdAt: 200 }))
        .mockResolvedValueOnce(JSON.stringify({ requestId: "c", userId: "user-1", createdAt: 300 }));

      const tasks = await service.getTasksByUserId("user-1");

      expect(tasks.map(t => t.requestId)).toEqual(["c", "a"]);
    });
  });
});
