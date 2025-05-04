import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { User } from "./entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import * as bcrypt from "bcrypt";
import { UpdateUserDto } from "./dto/update-user.dto";
import { generate } from 'random-words';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    if (!user.telegramId) {
      user.secretPhrase = generate({exactly: 1, wordsPerString: 4, minLength: 9})[0];
    }

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ["profiles"],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(`User with email "${email}" not found`);
    }

    return user;
  }

  async findByTelegramId(telegramId: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { telegramId },
    });
    if (!user) {
      throw new NotFoundException(`User with telegramId "${telegramId}" not found`);
    }
    return user;
  }

  async findBySecretPhrase(secretPhrase: string): Promise<User> {
    if (!secretPhrase || secretPhrase.length < 1) {
      throw new BadRequestException("Secret phrase is required");
    }

    const user = await this.usersRepository.findOne({
      where: { secretPhrase },
    });
    if (!user) {
      throw new NotFoundException(`User with secret phrase "${secretPhrase}" not found`);
    }
    return user;
  }

  async connectTelegram(telegramId: number, secretPhrase: string): Promise<User> {
    const user = await this.findBySecretPhrase(secretPhrase);
    user.telegramId = telegramId;
    //remove secret phrase
    user.secretPhrase = "";
    return this.usersRepository.save(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    this.usersRepository.merge(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActivated) {
      throw new UnauthorizedException("User account is not activated");
    }

    return user;
  }
}
