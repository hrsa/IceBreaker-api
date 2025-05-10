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
- `npm run test` - Run tests
- `npm run migration:generate -- ./src/migrations/MigrationName` - Generate a new migration
- `npm run migration:run` - Run migrations
- `npm run migration:revert` - Revert the last migration

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