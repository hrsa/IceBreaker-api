import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { LanguageUtilsService } from '../common/utils/language-utils.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private languageUtilsService: LanguageUtilsService,
    private eventEmitter: EventEmitter2
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoriesRepository.create();
    this.languageUtilsService.mapPropertyToField(category, 'name', createCategoryDto.name, createCategoryDto.language);
    this.languageUtilsService.mapPropertyToField(category, 'description', createCategoryDto.description, createCategoryDto.language);
    const savedCategory = await this.categoriesRepository.save(category);
    this.eventEmitter.emit('category.created', savedCategory);
    return savedCategory;
  }

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({
      order: { createdAt: 'ASC' }
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['cards'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    if (updateCategoryDto.name && updateCategoryDto.language) {
      this.languageUtilsService.mapPropertyToField(category, 'name', updateCategoryDto.name, updateCategoryDto.language);
    }
    if (updateCategoryDto.description && updateCategoryDto.language) {
      this.languageUtilsService.mapPropertyToField(category, 'description', updateCategoryDto.description, updateCategoryDto.language);
    }
    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const result = await this.categoriesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }
  }

  async getCardsCount(id: string): Promise<number> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['cards'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found or has no cards.`);
    }

    return category.cards ? category.cards.length : 0;
  }

}
