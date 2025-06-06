import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RedisSessionService } from "./redis-session.middleware";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [RedisSessionService],
  exports: [RedisSessionService],
})
export class RedisSessionModule {}
