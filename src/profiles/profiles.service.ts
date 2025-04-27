import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  CardPreference,
  CardStatus,
} from '../card-preferences/entitites/card-preference.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private profilesRepository: Repository<Profile>,
    @InjectRepository(CardPreference)
    private cardPreferencesRepository: Repository<CardPreference>,
  ) {}

  async create(createProfileDto: CreateProfileDto): Promise<Profile> {
    const profile = this.profilesRepository.create(createProfileDto);
    return this.profilesRepository.save(profile);
  }

  async findAll(userId: string): Promise<Profile[]> {
    return this.profilesRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, userId?: string): Promise<Profile> {
    const profile = await this.profilesRepository.findOne({
      where: { id },
      relations: ['cardPreferences', 'cardPreferences.card'],
    });

    if (!profile) {
      throw new NotFoundException(`Profile with ID "${id}" not found`);
    }
    if (userId && profile.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this profile',
      );
    }

    return profile;
  }

  async update(
    id: string,
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Profile> {
    const profile = await this.findOne(id, userId);
    this.profilesRepository.merge(profile, updateProfileDto);
    return this.profilesRepository.save(profile);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.findOne(id, userId);
    if (!result) {
      throw new NotFoundException(`Profile with ID "${id}" not found`);
    }
    await this.profilesRepository.delete(id);
  }

  async getCardPreferences(
    profileId: string,
    status?: string,
    userId?: string,
  ): Promise<CardPreference[]> {
    await this.findOne(profileId, userId);

    const queryBuilder = this.cardPreferencesRepository
      .createQueryBuilder('preference')
      .leftJoinAndSelect('preference.card', 'card')
      .leftJoinAndSelect('card.category', 'category')
      .where('preference.profileId = :profileId', { profileId });

    if (status) {
      if (Object.values(CardStatus).includes(status as CardStatus)) {
        queryBuilder.andWhere('preference.status = :status', { status });
      }
    }

    return queryBuilder.getMany();
  }
}
