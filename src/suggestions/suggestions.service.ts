import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Suggestion } from './entities/suggestion.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SuggestionsService {
  constructor(
    @InjectRepository(Suggestion)
    private suggestionsRepository: Repository<Suggestion>,
  ) {}

  create(createSuggestionDto: CreateSuggestionDto) {
    const suggestion = this.suggestionsRepository.create(createSuggestionDto);
    return this.suggestionsRepository.save(suggestion);
  }

  async findAll(userId: string) {
    return this.suggestionsRepository.createQueryBuilder('suggestion')
      .leftJoinAndSelect('suggestion.user', 'user')
      .leftJoinAndSelect('suggestion.category', 'category')
      .where('user.id = :userId', { userId })
      .getMany();
  }

  async findOne(id: string, userId: string, isAdmin: boolean) {
    const suggestion = await this.suggestionsRepository.findOneBy({ id });
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }
    if (suggestion.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to access this suggestion');
    }
    return suggestion;
  }

  async update(id: string, updateSuggestionDto: UpdateSuggestionDto) {
    let suggestion = await this.suggestionsRepository.findOneBy({id})
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }
    this.suggestionsRepository.merge(suggestion, updateSuggestionDto);
    return this.suggestionsRepository.save(suggestion);
  }

  async remove(id: string) {
    const result = await this.suggestionsRepository.findOneBy({id});
    if (!result) {
      throw new NotFoundException('Suggestion not found');
    }
    return this.suggestionsRepository.delete(id);
  }
}
