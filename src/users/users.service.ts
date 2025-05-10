import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { User } from "./entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import * as argon2 from "argon2";
import { UpdateUserDto } from "./dto/update-user.dto";
import { generate } from "random-words";
import { DonationReceivedEvent } from "../webhooks/events/donation-received.event";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { UserCreditsUpdatedEvent } from "./events/user-credits-updated.event";
import { GameGenerationCompletedEvent } from "../ai/events/game-generation-completed.event";
import { GameReadyToPlayEvent } from "../ai/events/game-ready-to-play.event";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private eventEmitter: EventEmitter2
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new BadRequestException("User already exists");
    }

    const hashedPassword = await argon2.hash(createUserDto.password);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    if (!user.telegramId) {
      user.secretPhrase = generate({ exactly: 1, wordsPerString: 4, minLength: 9 })[0];
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

  async findByTelegramId(telegramId: string): Promise<User> {
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
    user.telegramId = telegramId.toString();
    //remove secret phrase
    user.secretPhrase = "";
    return this.usersRepository.save(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = await argon2.hash(updateUserDto.password);
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

    const isPasswordValid = await argon2.verify(user.password, password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActivated) {
      throw new UnauthorizedException("User account is not activated");
    }

    return user;
  }

  @OnEvent("donation.received")
  async onDonationReceived(event: DonationReceivedEvent) {
    await this.addCredit(event.userId, event.email, event.amount);
  }

  @OnEvent("game.generation.completed")
  async onGameGenerationCompleted(event: GameGenerationCompletedEvent) {
    const { userId, categoryId } = event;
    await this.spendCredit(userId, undefined, 1);
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ["privateCategories"],
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    const category = user.privateCategories.find(c => c.id === categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID "${categoryId}" not found`);
    }

    this.eventEmitter.emit("game.ready.to.play", new GameReadyToPlayEvent(user, category));
  }

  async addCredit(id?: string, email?: string, credits = 1): Promise<User> {
    let user: User | undefined;
    if (id) {
      user = await this.findOne(id);
    }
    if (email) {
      user = await this.findByEmail(email);
    }
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" and email "${email}" not found`);
    }

    user.credits += credits;
    await this.usersRepository.save(user);
    this.eventEmitter.emit("user.credits.updated", new UserCreditsUpdatedEvent(parseInt(user.telegramId), user.credits));
    return user;
  }

  async spendCredit(id?: string, email?: string, credits = 1): Promise<User> {
    let user: User | undefined;
    if (id) {
      user = await this.findOne(id);
    }
    if (email) {
      user = await this.findByEmail(email);
    }
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" and email "${email}" not found`);
    }

    user.credits -= credits;
    await this.usersRepository.save(user);
    this.eventEmitter.emit("user.credits.updated", new UserCreditsUpdatedEvent(parseInt(user.telegramId), user.credits));
    return user;
  }
}
