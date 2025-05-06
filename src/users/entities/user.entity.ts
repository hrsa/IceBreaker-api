import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Profile } from "../../profiles/entities/profile.entity";
import { Suggestion } from "../../suggestions/entities/suggestion.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActivated: boolean;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column({ nullable: true })
  telegramId: string;

  @Column({ nullable: true, unique: true })
  secretPhrase: string;

  @OneToMany(() => Profile, profile => profile.user, {
    cascade: true,
    onDelete: "CASCADE",
  })
  profiles: Profile[];

  @OneToMany(() => Suggestion, suggestion => suggestion.user, {
    cascade: true,
    onDelete: "CASCADE",
  })
  suggestions: Suggestion[];
}
