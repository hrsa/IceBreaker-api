import { Injectable } from '@nestjs/common';
import { AppLanguage, EntityWithLanguageProperties } from '../constants/app-language.enum';



@Injectable()
export class LanguageUtilsService {
  hasPropertyByLanguage(entity: EntityWithLanguageProperties, propertyPrefix: string, language: AppLanguage): boolean {
    const propertyName = `${propertyPrefix}_${language}`;
    return !!entity[propertyName];
  }

  getPropertyByLanguage(entity: EntityWithLanguageProperties, propertyPrefix: string, language: AppLanguage): string | null {
    const propertyName = `${propertyPrefix}_${language}`;
    return entity[propertyName] || null;
  }

  mapPropertyToField(entity: EntityWithLanguageProperties, propertyPrefix: string, property: string, language: AppLanguage) {
    const propertyName = `${propertyPrefix}_${language}`;
    entity[propertyName] = property;
    return entity;
  }
}
