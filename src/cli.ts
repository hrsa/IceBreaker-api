import { CommandFactory } from "nest-commander";
import { CliModule } from './cli.module';

async function bootstrap() {
  await CommandFactory.run(CliModule, { logger: ["log", "error", "warn", "debug", "verbose"] });
}

bootstrap().catch((err) => {
  console.error("CLI Error:", err);
  process.exit(1);
});
