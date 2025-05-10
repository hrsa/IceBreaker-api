import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Card } from "./entities/card.entity";
import { Repository } from "typeorm";
import { CardPreference, CardStatus } from "../card-preferences/entitites/card-preference.entity";
import { CreateCardDto } from "./dto/create-card.dto";
import { CategoriesService } from "../categories/categories.service";
import { UpdateCardDto } from "./dto/update-card.dto";
import { LanguageUtilsService } from "../common/utils/language-utils.service";
import { GetRandomCardDto } from "./dto/get-random-card.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CardCreatedEvent } from "./events/card-created.event";

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private cardsRepository: Repository<Card>,
    private categoriesService: CategoriesService,
    private languageUtilsService: LanguageUtilsService,
    private eventEmitter: EventEmitter2
  ) {}

  async create(createCardDto: CreateCardDto): Promise<Card> {
    await this.categoriesService.findOne(createCardDto.categoryId, "", true);

    const card = this.cardsRepository.create(createCardDto);
    this.languageUtilsService.mapPropertyToField(card, "question", createCardDto.question, createCardDto.language);
    const savedCard = await this.cardsRepository.save(card);
    this.eventEmitter.emit("card.created", new CardCreatedEvent(savedCard));
    return savedCard;
  }

  async findAll(categoryId?: string): Promise<Card[]> {
    const queryBuilder = this.cardsRepository
      .createQueryBuilder("card")
      .leftJoinAndSelect("card.category", "category")
      .orderBy("card.createdAt", "DESC");

    if (categoryId) {
      queryBuilder.where("card.categoryId = :categoryId", { categoryId });
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Card> {
    const card = await this.cardsRepository.findOne({
      where: { id },
      relations: ["category"],
    });

    if (!card) {
      throw new NotFoundException(`Card with ID "${id}" not found`);
    }

    return card;
  }

  async update(id: string, updateCardDto: UpdateCardDto): Promise<Card> {
    if (updateCardDto.categoryId) {
      await this.categoriesService.findOne(updateCardDto.categoryId);
    }

    const card = await this.findOne(id);

    updateCardDto.updatedAt = new Date();

    if (updateCardDto.question && updateCardDto.language) {
      this.languageUtilsService.mapPropertyToField(card, "question", updateCardDto.question, updateCardDto.language);

      delete updateCardDto.question;
      delete updateCardDto.language;
    }

    this.cardsRepository.merge(card, updateCardDto);
    return this.cardsRepository.save(card);
  }

  async remove(id: string): Promise<void> {
    const result = await this.cardsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Card with ID "${id}" not found`);
    }
  }

  async getRandomCard(getRandomCardDto: GetRandomCardDto, userId?: string): Promise<Card[]> {
    const { profileId, categoryIds, includeArchived, includeLoved, limit = 1 } = getRandomCardDto;

    let validCategoryIds: string[] = [];

    if (categoryIds && categoryIds.length > 0) {
      for (const categoryId of categoryIds) {
        try {
          await this.categoriesService.findOne(categoryId, userId);
          validCategoryIds.push(categoryId);
        } catch (error) {}
      }
    } else {
      const publicCategories = await this.categoriesService.findAll(userId);
      validCategoryIds = publicCategories.map(category => category.id);
    }

    if (validCategoryIds.length === 0) {
      throw new NotFoundException("No accessible categories found");
    }

    const query = this.cardsRepository
      .createQueryBuilder("card")
      .leftJoinAndSelect("card.category", "category")
      .leftJoinAndSelect("card.profilePreferences", "cardPreference", "cardPreference.profileId = :profileId", { profileId })
      .where("card.categoryId IN (:...validCategoryIds)", { validCategoryIds });

    const banStatuses = [CardStatus.BANNED];
    if (!includeArchived) {
      banStatuses.push(CardStatus.ARCHIVED);
    }
    if (!includeLoved) {
      banStatuses.push(CardStatus.LOVED);
    }

    query.andWhere(qb => {
      const subQuery = qb
        .subQuery()
        .select("1")
        .from(CardPreference, "cardPreference")
        .where("cardPreference.cardId = card.id")
        .andWhere("cardPreference.profileId = :profileId", { profileId })
        .andWhere("cardPreference.status IN (:...banStatuses)", { banStatuses });

      return `NOT EXISTS ${subQuery.getQuery()}`;
    });

    query.orderBy("RANDOM()").limit(limit);

    const cards = await query.getMany();

    if (!cards || cards.length === 0) {
      throw new NotFoundException("No cards found matching the criteria");
    }

    return cards.map(card => {
      if (card.profilePreferences && card.profilePreferences.length > 0) {
        card.cardPreference = card.profilePreferences[0];
      }
      return card;
    });
  }

  async getRandomCardForGeneration(limit = 4): Promise<Card[]> {
    const query = this.cardsRepository.createQueryBuilder("card").orderBy("RANDOM()").limit(limit);

    return query.getMany();
  }

  async hasOnlyLovedCardsLeft(getRandomCardDto: GetRandomCardDto): Promise<boolean> {
    const { profileId, categoryIds } = getRandomCardDto;

    const query = this.cardsRepository
      .createQueryBuilder("card")
      .leftJoin("card.profilePreferences", "cardPreference", "cardPreference.profileId = :profileId", { profileId })
      .where("card.id IS NOT NULL");

    if (categoryIds && categoryIds.length > 0) {
      query.andWhere("card.categoryId IN (:...categoryIds)", { categoryIds });
    }

    query.andWhere(`(
    cardPreference.id IS NULL OR 
    (cardPreference.status = '${CardStatus.ACTIVE}')
  )`);

    const count = await query.getCount();

    return count === 0;
  }
}
