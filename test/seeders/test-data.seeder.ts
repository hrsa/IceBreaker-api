import { DataSource } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';

export class TestDataSeeder {
  constructor(private dataSource: DataSource) {}

  async seed(): Promise<void> {
    await this.seedUsers();
  }

  private async seedUsers(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);

    await userRepository.save([
      {
        email: 'test@example.com',
        password: 'hashedpassword', // Use bcrypt to hash in real implementation
        name: 'Test User',
        isActivated: true,
        // other fields
      },
    ]);
  }
}