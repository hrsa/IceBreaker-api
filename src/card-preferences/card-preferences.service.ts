import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CardPreference, CardStatus } from "./entitites/card-preference.entity";
import { UpdateCardPreferenceDto } from "./dto/update-card-preference.dto";
import { ProfilesService } from "../profiles/profiles.service";
import { CardsService } from "../cards/cards.service";

@Injectable()
export class CardPreferencesService {
  constructor(
    @InjectRepository(CardPreference)
    private preferencesRepository: Repository<CardPreference>,
    private profilesService: ProfilesService,
    private cardsService: CardsService
  ) {}

  async findAll(profileId: string, status?: string): Promise<CardPreference[]> {
    await this.profilesService.findOne(profileId);

    const queryBuilder = this.preferencesRepository
      .createQueryBuilder("preference")
      .leftJoinAndSelect("preference.card", "card")
      .leftJoinAndSelect("card.category", "category")
      .where("preference.profileId = :profileId", { profileId });

    if (status) {
      queryBuilder.andWhere("preference.status = :status", { status });
    }

    return queryBuilder.getMany();
  }

  async findOne(cardId: string, profileId: string): Promise<CardPreference> {
    const preference = await this.preferencesRepository.findOne({
      where: { cardId, profileId },
      relations: ["card", "card.category"],
    });

    if (!preference) {
      throw new NotFoundException(`Preference for card ${cardId} and profile ${profileId} not found`);
    }

    return preference;
  }

  async updatePreference(cardId: string, profileId: string, updateDto: UpdateCardPreferenceDto): Promise<CardPreference | null> {
    await this.cardsService.findOne(cardId);
    await this.profilesService.findOne(profileId);

    let preference = await this.preferencesRepository.findOne({
      where: { cardId, profileId },
    });

    if (!preference) {
      if (updateDto.status === CardStatus.ACTIVE) return null;
      preference = this.preferencesRepository.create({
        cardId,
        profileId,
        status: updateDto.status,
      });
    }

    if (updateDto.status === CardStatus.ACTIVE) {
      await this.preferencesRepository.delete(preference);
      return null;
    }

    preference.lastInteractionAt = new Date();
    return this.preferencesRepository.save(preference);
  }

  async getActiveCardsForProfile(profileId: string): Promise<CardPreference[]> {
    return this.findAll(profileId, CardStatus.ACTIVE);
  }

  async getArchivedCardsForProfile(profileId: string): Promise<CardPreference[]> {
    return this.findAll(profileId, CardStatus.ARCHIVED);
  }

  async getBannedCardsForProfile(profileId: string): Promise<CardPreference[]> {
    return this.findAll(profileId, CardStatus.BANNED);
  }

  async getLovedCardsForProfile(profileId: string): Promise<CardPreference[]> {
    return this.findAll(profileId, CardStatus.LOVED);
  }

  async archiveCard(cardId: string, profileId: string) {
    return this.updatePreference(cardId, profileId, { status: CardStatus.ARCHIVED });
  }

  async reactivateCard(cardId: string, profileId: string) {
    return this.updatePreference(cardId, profileId, { status: CardStatus.ACTIVE });
  }

  async banCard(cardId: string, profileId: string) {
    return this.updatePreference(cardId, profileId, { status: CardStatus.BANNED });
  }

  async loveCard(cardId: string, profileId: string) {
    return this.updatePreference(cardId, profileId, { status: CardStatus.LOVED });
  }
}
