import { LanguageUtilsService } from "../src/common/utils/language-utils.service";
import { AppLanguage } from "../src/common/constants/app-language.enum";

describe("LanguageUtilsService", () => {
  let service: LanguageUtilsService;

  beforeEach(() => {
    service = new LanguageUtilsService();
  });

  describe("hasPropertyByLanguage", () => {
    it("returns true when the language field has content", () => {
      const entity = { question_en: "Hello" } as any;

      expect(service.hasPropertyByLanguage(entity, "question", AppLanguage.ENGLISH)).toBe(true);
    });

    it("returns false for missing or empty fields", () => {
      const entity = { question_en: "", question_fr: null } as any;

      expect(service.hasPropertyByLanguage(entity, "question", AppLanguage.ENGLISH)).toBe(false);
      expect(service.hasPropertyByLanguage(entity, "question", AppLanguage.FRENCH)).toBe(false);
      expect(service.hasPropertyByLanguage(entity, "question", AppLanguage.RUSSIAN)).toBe(false);
    });
  });

  describe("getPropertyByLanguage", () => {
    it("returns the field value for the requested language", () => {
      const entity = { question_it: "Ciao?" } as any;

      expect(service.getPropertyByLanguage(entity, "question", AppLanguage.ITALIAN)).toBe("Ciao?");
    });

    it("returns null when the field is missing", () => {
      const entity = {} as any;

      expect(service.getPropertyByLanguage(entity, "question", AppLanguage.RUSSIAN)).toBeNull();
    });
  });

  describe("mapPropertyToField", () => {
    it.each([
      ["question", AppLanguage.ENGLISH, "question_en"],
      ["question", AppLanguage.RUSSIAN, "question_ru"],
      ["name", AppLanguage.FRENCH, "name_fr"],
      ["description", AppLanguage.ITALIAN, "description_it"],
    ])("maps %s (%s) to %s", (prefix, language, expectedField) => {
      const entity = {} as any;

      const result = service.mapPropertyToField(entity, prefix, "value", language);

      expect(result).toBe(entity);
      expect(entity[expectedField]).toBe("value");
    });
  });
});
