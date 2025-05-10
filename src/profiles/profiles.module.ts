import { Module } from "@nestjs/common";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { Profile } from "./entities/profile.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CardPreference } from "../card-preferences/entitites/card-preference.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Profile, CardPreference])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
