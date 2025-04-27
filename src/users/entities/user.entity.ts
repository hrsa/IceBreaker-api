import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../../profiles/entities/profile.entity';
import { Suggestion } from '../../suggestions/entities/suggestion.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ default: true })
  isActivated: boolean;

  @Column( { default: false })
  isAdmin: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Profile, profile => profile.user)
  profiles: Profile[];

  @OneToMany(() => Suggestion, suggestion => suggestion.user)
  suggestions: Suggestion[];
}
