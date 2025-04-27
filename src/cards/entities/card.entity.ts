import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { CardPreference } from '../../card-preferences/entitites/card-preference.entity';

export enum CardLanguage {
  ENGLISH = 'en',
  RUSSIAN = 'ru',
  FRENCH = 'fr',
  ITALIAN = 'it',
}

@Entity()
export class Card {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({nullable: true})
  question_en: string;

  @Column({nullable: true})
  question_ru: string;

  @Column({nullable: true})
  question_fr: string;

  @Column({nullable: true})
  question_it: string;

  @ManyToOne(() => Category, category => category.cards)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column()
  categoryId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => CardPreference, preference => preference.card)
  profilePreferences: CardPreference[];
}
