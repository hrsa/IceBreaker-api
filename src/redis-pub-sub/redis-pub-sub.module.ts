import { Module } from "@nestjs/common";
import { RedisPubSubService } from "./redis-pub-sub.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  providers: [RedisPubSubService],
  exports: [RedisPubSubService],
})
export class RedisPubSubModule {}
