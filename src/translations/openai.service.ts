import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAIService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: configService.get<string>('OPENAI_API_KEY'),
    })
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text to ${targetLanguage}. Maintain the original meaning, tone, and style. Only return the translated text without any additional comments or explanations.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
      });

      if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
        return response.choices[0].message.content.trim();
      }
      this.logger.error(`Translation error`, response);
      throw new Error(`Failed to translate text`);
    } catch (error) {
      this.logger.error(`Translation error: ${error.message}`, error.stack);
      throw new Error(`Failed to translate text: ${error.message}`);
    }
  }
}