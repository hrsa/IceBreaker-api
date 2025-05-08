import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Card } from '../../cards/entities/card.entity';
import { Suggestion } from '../../suggestions/entities/suggestion.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name_en: string;

  @Column({ nullable: true })
  name_ru: string;

  @Column({ nullable: true })
  name_fr: string;

  @Column({ nullable: true })
  name_it: string;

  @Column({ nullable: true })
  description_en: string;

  @Column({ nullable: true })
  description_ru: string;

  @Column({ nullable: true })
  description_fr: string;

  @Column({ nullable: true })
  description_it: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Card, card => card.category, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  cards: Card[];

  @OneToMany(() => Suggestion, suggestion => suggestion.category)
  suggestions: Suggestion[];
}
