import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Category } from "../../categories/entities/category.entity";

@Entity()
export class Suggestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Category, category => category.suggestions)
  category?: Category;

  @Column({ nullable: true })
  categoryId: string;

  @Column()
  question: string;

  @Column({ default: false })
  accepted: boolean;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @ManyToOne(() => User, user => user.suggestions, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  userId: string;
}
