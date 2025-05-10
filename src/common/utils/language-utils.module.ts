import { Module } from "@nestjs/common";
import { LanguageUtilsService } from "./language-utils.service";

@Module({
  providers: [LanguageUtilsService],
  exports: [LanguageUtilsService],
})
export class LanguageUtilsModule {}
