import { ResendModule } from 'nestjs-resend';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailTemplatesService } from './email-templates.service';

@Module({
  imports: [
    ConfigModule,
    ResendModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        apiKey: configService.get("RESEND_API_KEY", ""),
      })
    }) as DynamicModule,
  ],
  providers: [EmailService, EmailTemplatesService],
  exports: [EmailService],
})
export class EmailModule {}
