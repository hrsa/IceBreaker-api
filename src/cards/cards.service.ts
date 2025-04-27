import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Card } from './entities/card.entity';
import { Repository } from 'typeorm';
import { CardPreference, CardStatus } from '../card-preferences/entitites/card-preference.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { CategoriesService } from '../categories/categories.service';
import { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card)
    private cardsRepository: Repository<Card>,
    @InjectRepository(CardPreference)
    private cardPreferencesRepository: Repository<CardPreference>,
    private categoriesService: CategoriesService,
  ) {}

  async create(createCardDto: CreateCardDto): Promise<Card> {
    await this.categoriesService.findOne(createCardDto.categoryId);

    const card = this.cardsRepository.create(createCardDto);
    return this.cardsRepository.save(card);
  }

  async findAll(categoryId?: string): Promise<Card[]> {
    const queryBuilder = this.cardsRepository.createQueryBuilder('card')
      .leftJoinAndSelect('card.category', 'category')
      .orderBy('card.createdAt', 'DESC');

    if (categoryId) {
      queryBuilder.where('card.categoryId = :categoryId', { categoryId });
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Card> {
    const card = await this.cardsRepository.findOne({
      where: { id },
      relations: ['category'],
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

    this.cardsRepository.merge(card, updateCardDto);
    return this.cardsRepository.save(card);
  }

  async remove(id: string): Promise<void> {
    const result = await this.cardsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Card with ID "${id}" not found`);
    }
  }


  async getRandomCard(
    categoryId: string,
    profileId: string,
    includeArchived: boolean = false,
  ): Promise<Card> {
    const query = this.cardsRepository.createQueryBuilder('card')
      .where('card.categoryId = :categoryId', { categoryId });

    const banStatuses = [CardStatus.BANNED];
    if (!includeArchived) {
      banStatuses.push(CardStatus.ARCHIVED);
    }

    const bannedCardIds = await this.cardPreferencesRepository.createQueryBuilder('cardPreference')
      .select('cardPreference.cardId')
      .where('cardPreference.profileId = :profileId', { profileId })
      .andWhere('cardPreference.status IN (:...banStatuses)', { banStatuses })
      .getMany();

    if (bannedCardIds.length > 0) {
      query.andWhere('card.id NOT IN (:...bannedIds)', { bannedIds: bannedCardIds.map(p => p.cardId) });
    }

    query.orderBy('RAND()');

    const card = await query.getOne();
    if (!card) {
      throw new Error('No cards found');
    }

    return card;
  }
}
