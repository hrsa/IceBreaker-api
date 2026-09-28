# IceMelter

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-red.svg" alt="NestJS Version" />
  <img src="https://img.shields.io/badge/Telegraf-4.16-blue.svg" alt="Telegraf Version" />
  <img src="https://img.shields.io/badge/TypeORM-0.3-green.svg" alt="TypeORM Version" />
  <img src="https://img.shields.io/badge/License-CC%20BY--NC%204.0-green.svg" alt="License" />
</p>

## Description

IceMelter is an API with a Telegram bot built with NestJS that helps users spark meaningful conversations with anyone.
The application provides conversation starters, icebreaker questions, and interactive games to facilitate better communication and connection between people.

## Features

- **Telegram Bot Integration**: Seamless interaction through Telegram
- **Conversation Starters**: Curated questions to break the ice in any situation
- **Multiple Languages**: Supports internationalization (i18n) for multiple languages
- **User Profiles**: Create and manage multiple conversation profiles
- **Categories**: Browse questions by different categories
- **AI-Powered Games**: Generate custom conversation games using AI
- **Suggestion System**: Users can suggest new questions
- **Webhook Support**: Uses webhooks for efficient Telegram updates

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- Redis
- Telegram Bot Token (from BotFather)
- Public domain with SSL for webhook (or ngrok for development)
- OpenAI API key (for AI features)

## Available Scripts

- `npm run build` - Build the application
- `npm run start:dev` - Run in development mode with hot reload
- `npm run start:prod` - Run in production mode
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run e2e tests (see Testing section)
- `npm run migration:generate -- ./src/migrations/MigrationName` - Generate a new migration
- `npm run migration:run` - Run migrations
- `npm run migration:revert` - Revert the last migration

## Testing

The project has two test suites:

### Unit tests

```bash
npm run test
```

No external services are required: all repositories, Redis, OpenAI and Telegram
integrations are mocked. Use `npx jest test/<file>.spec.ts` to run a single suite.

### E2E tests

```bash
npm run test:e2e
```

E2E specs run the full NestJS application against a real PostgreSQL and Redis
instance configured via `.env.test` (see the required variables below). The test
data source drops and re-migrates the schema on every run, so **the configured
database must be a dedicated test database - never a local development or
production database**.

For a quick, disposable local setup:

```bash
docker run -d --name icebreaker-test-db -p 5433:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=test_icebreaker postgres:17
docker run -d --name icebreaker-test-redis -p 6380:6379 redis:7.4.3

DB_HOST=localhost DB_PORT=5433 REDIS_HOST=localhost REDIS_PORT=6380 npm run test:e2e

# cleanup
docker rm -f icebreaker-test-db icebreaker-test-redis
```

Required `.env.test` variables (environment variables take precedence, which
is how CI provides them):

```env
APP_ENV=testing
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=test_icebreaker
REDIS_HOST=localhost
REDIS_PORT=6380
JWT_SECRET=<any test secret>
KOFI_VERIFICATION_TOKEN=<any test token>
ADMIN_TELEGRAM_ID=<any id>
# Dummies are fine: tests mock OpenAI and Telegram
OPENAI_API_KEY=dummy
TELEGRAM_BOT_TOKEN=dummy
GAME_GENERATION_PROMPT=YWJjZA==
TRANSLATION_PROMPT=YWJjZA==
```

Notes:

- E2E specs share one database, so the suite is configured to run sequentially
  (`maxWorkers: 1` in `test/jest-e2e.json`).
- The e2e suite never calls external APIs: the Telegram module is mocked and the
  AI service is overridden in `test/ai.e2e-spec.ts`.

### CI

`.github/workflows/tests.yml` runs the unit tests standalone and the e2e tests
against throwaway `postgres`/`redis` service containers (`test_icebreaker`
database) on every push and pull request. Lint is not part of CI yet due to
pre-existing eslint errors on the default branch.

## Project Structure

- `src/` - Source code
  - `main.ts` - Application entry point
  - `app.module.ts` - Main application module
  - `telegram/` - Telegram bot integration
  - `users/` - User management
  - `profiles/` - User profiles
  - `cards/` - Conversation cards/questions
  - `categories/` - Question categories
  - `ai/` - AI integration for game generation
  - `i18n/` - Internationalization files
  - `webhooks/` - Webhook handlers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


## Support

If you like this project, a coffee is always appreciated!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/anton_c)

## Author

- Anton Cherednichenko