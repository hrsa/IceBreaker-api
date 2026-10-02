import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { TelegrafModule, getBotToken } from "nestjs-telegraf";
import { session, Telegraf } from "telegraf";
import { I18nService } from "nestjs-i18n";
import { TelegramUpdate } from "../src/telegram/telegram.update";
import { TelegramService } from "../src/telegram/telegram.service";
import { StateFactory } from "../src/telegram/states/state.factory";
import { CardRetrievalState } from "../src/telegram/states/card-retrieval.state";
import { CategorySelectionState } from "../src/telegram/states/category-selection.state";
import { ProfileSelectionState } from "../src/telegram/states/profile-selection.state";

describe("Telegram integration (real nestjs-telegraf module)", () => {
  let app: INestApplication;
  let bot: Telegraf;

  const setCommandsSpy = jest.fn();
  const deleteUserMessageSpy = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TelegrafModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: () => ({
            token: "123456:integration-test-token",
            middlewares: [session()],
            include: [],
            launchOptions: false,
          }),
        }),
      ],
      providers: [
        TelegramUpdate,
        {
          provide: TelegramService,
          useValue: {
            setCommands: setCommandsSpy,
            deleteUserMessage: deleteUserMessageSpy,
            createLanguageSelectionKeyboard: jest.fn(() => ({ reply_markup: { inline_keyboard: [] } })),
          },
        },
        { provide: StateFactory, useValue: { getState: jest.fn() } },
        { provide: CardRetrievalState, useValue: { handle: jest.fn() } },
        { provide: CategorySelectionState, useValue: { handle: jest.fn() } },
        { provide: ProfileSelectionState, useValue: { handle: jest.fn() } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    bot = app.get<Telegraf>(getBotToken());
    // keep offline
    bot.botInfo = {
      id: 123456,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    } as never;
    bot.telegram.sendMessage = jest.fn().mockResolvedValue({ message_id: 42 }) as never;
    bot.telegram.setMyCommands = jest.fn().mockResolvedValue(true) as never;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("instantiates the Telegraf bot through the real module wiring", () => {
    expect(bot).toBeInstanceOf(Telegraf);
  });

  it("resolves the update class from the DI container", () => {
    expect(app.get(TelegramUpdate)).toBeInstanceOf(TelegramUpdate);
  });

  it("discovers @Command handlers from decorator metadata and executes them on a dispatched update", async () => {
    setCommandsSpy.mockClear();
    deleteUserMessageSpy.mockClear();

    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 1, type: "private", first_name: "Tester" },
        from: { id: 1, is_bot: false, first_name: "Tester", username: "tester", language_code: "en" },
        text: "/language",
        // command matching requires the bot_command entity
        entities: [{ offset: 0, length: 9, type: "bot_command" }],
      },
    });

    expect(setCommandsSpy).toHaveBeenCalledTimes(1);
    expect(deleteUserMessageSpy).toHaveBeenCalledTimes(1);
  });
});
