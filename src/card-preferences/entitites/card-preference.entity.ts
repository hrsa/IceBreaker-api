import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Profile } from "../../profiles/entities/profile.entity";
import { Card } from "../../cards/entities/card.entity";

export enum CardStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
  LOVED = "loved",
  BANNED = "banned",
}

@Entity()
export class CardPreference {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Profile, profile => profile.cardPreferences, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE"
  })
  @JoinColumn({ name: "profileId" })
  profile: Profile;

  @Column()
  profileId: string;

  @ManyToOne(() => Card, card => card.profilePreferences, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE"
  })
  @JoinColumn({ name: "cardId" })
  card: Card;

  @Column()
  cardId: string;

  @Column({
    type: "enum",
    enum: CardStatus,
    default: CardStatus.ACTIVE,
  })
  status: CardStatus;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastInteractionAt: Date;
}
