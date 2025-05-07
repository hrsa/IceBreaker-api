import { DataSource } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import { Category } from '../../src/categories/entities/category.entity';
import * as bcrypt from 'bcrypt';

export class TestDataSeeder {
  constructor(private dataSource: DataSource) {}

  async seed(): Promise<void> {
    await this.seedUsers();
    await this.seedCategories();
  }

  private async seedUsers(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);
    const adminPassword = await bcrypt.hash("adminpassword", 10);
    const userPassword= await bcrypt.hash("password", 10);

    await userRepository.save([
      {
        email: 'admin@example.com',
        password: adminPassword,
        name: 'Admin',
        isActivated: true,
        isAdmin: true,
      },
    ]);

    await userRepository.save([
      {
        email: 'user@example.com',
        password: userPassword,
        name: 'User',
        isActivated: true,
        secretPhrase: "secret phrase",
      },
    ]);
  }

  private async seedCategories(): Promise<void> {
    const categoryRepository = this.dataSource.getRepository(Category);

    await categoryRepository.save([
      {
        name_en: 'Category 1',
        name_fr: 'Catégorie 1',
        name_ru: 'Категория 1',
        name_it: 'Categoria 1',
        description_en: "Description 1",
        description_fr: "Description 1",
        description_ru: "Description 1",
        description_it: "Description 1",
      },
    ]);
    await categoryRepository.save([
      {
        name_en: 'Category 2',
        name_fr: 'Catégorie 2',
        name_ru: 'Категория 2',
        name_it: 'Categoria 2',
        description_en: "Description 2",
        description_fr: "Description 2",
        description_ru: "Description 2",
        description_it: "Description 2",
      },
    ]);
  }
}