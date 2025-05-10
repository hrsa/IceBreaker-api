import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { Category } from "../../categories/entities/category.entity";
import { CardPreference } from "../../card-preferences/entitites/card-preference.entity";

@Entity()
export class Card {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  question_en: string;

  @Column({ nullable: true })
  question_ru: string;

  @Column({ nullable: true })
  question_fr: string;

  @Column({ nullable: true })
  question_it: string;

  @ManyToOne(() => Category, category => category.cards, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "categoryId" })
  category: Category;

  @Column()
  categoryId: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date;

  @OneToMany(() => CardPreference, preference => preference.card, {
    cascade: true,
    onDelete: "CASCADE",
  })
  profilePreferences: CardPreference[];

  cardPreference?: CardPreference;

  getPreferenceForProfile(profileId: string): CardPreference | undefined {
    if (!this.profilePreferences) {
      return undefined;
    }

    return this.profilePreferences.find(preference => preference.profileId === profileId);
  }
}
