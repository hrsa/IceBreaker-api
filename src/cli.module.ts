// src/cli.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BackupsModule } from "./backups/backups.module";
import { BackupCommand } from "./commands/backup.command";
import { RedisPubSubModule } from "./redis-pub-sub/redis-pub-sub.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.getOrThrow("DB_HOST"),
        port: configService.getOrThrow<number>("DB_PORT"),
        username: configService.getOrThrow("DB_USER"),
        password: configService.getOrThrow("DB_PASSWORD"),
        database: configService.getOrThrow("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: false,
      }),
    }),
    BackupsModule,
    RedisPubSubModule,
  ],
  providers: [BackupCommand],
})
export class CliModule {}
