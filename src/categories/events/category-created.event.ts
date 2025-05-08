import { Category } from '../entities/category.entity';

export class CategoryCreatedEvent {
  constructor(public readonly category: Category) {}
}