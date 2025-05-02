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

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private cardsRepository: Repository<Card>,
    @InjectRepository(CardPreference)
    private cardPreferencesRepository: Repository<CardPreference>,
    private categoriesService: CategoriesService,
    private languageUtilsService: LanguageUtilsService
  ) {}

  async create(createCardDto: CreateCardDto): Promise<Card> {
    await this.categoriesService.findOne(createCardDto.categoryId);

    const card = this.cardsRepository.create(createCardDto);
    this.languageUtilsService.mapPropertyToField(card, "question", createCardDto.question, createCardDto.language);
    return this.cardsRepository.save(card);
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

  async getRandomCard(getRandomCardDto: GetRandomCardDto): Promise<Card[]> {
    const { profileId, categoryIds, includeArchived, includeLoved, limit = 1 } = getRandomCardDto;

    const query = this.cardsRepository
      .createQueryBuilder("card")
      .leftJoinAndSelect("card.category", "category")
      .leftJoinAndSelect("card.profilePreferences", "cardPreference", "cardPreference.profileId = :profileId", { profileId });

    if (categoryIds && categoryIds.length > 0) {
      query.where("card.categoryId IN (:...categoryIds)", { categoryIds });
    }

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
        .from(CardPreference, "cardPreference") // Use entity class name
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

  async hasOnlyLovedCardsLeft(getRandomCardDto: GetRandomCardDto): Promise<boolean> {
    const { profileId, categoryIds } = getRandomCardDto;

    const query = this.cardsRepository
      .createQueryBuilder('card')
      .leftJoin(
        'card.profilePreferences',
        'cardPreference',
        'cardPreference.profileId = :profileId',
        { profileId }
      )
      .where('card.id IS NOT NULL');

    if (categoryIds && categoryIds.length > 0) {
      query.andWhere('card.categoryId IN (:...categoryIds)', { categoryIds });
    }

    query.andWhere(`(
    cardPreference.id IS NULL OR 
    (cardPreference.status = '${CardStatus.ACTIVE}')
  )`);

    const count = await query.getCount();

    return count === 0;
  }

}
