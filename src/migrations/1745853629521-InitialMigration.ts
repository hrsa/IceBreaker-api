import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1745853629521 implements MigrationInterface {
  name = 'InitialMigration1745853629521';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "suggestion"
                             (
                               "id"         uuid              NOT NULL DEFAULT uuid_generate_v4(),
                               "categoryId" uuid,
                               "question"   character varying NOT NULL,
                               "accepted"   boolean           NOT NULL DEFAULT false,
                               "createdAt"  TIMESTAMP         NOT NULL DEFAULT now(),
                               "userId"     uuid,
                               CONSTRAINT "PK_aa072a020434ddd7104de98eebb" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "category"
                             (
                               "id"             uuid      NOT NULL DEFAULT uuid_generate_v4(),
                               "name_en"        character varying,
                               "name_ru"        character varying,
                               "name_fr"        character varying,
                               "name_it"        character varying,
                               "description_en" character varying,
                               "description_ru" character varying,
                               "description_fr" character varying,
                               "description_it" character varying,
                               "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
                               CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "card"
                             (
                               "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
                               "question_en" character varying,
                               "question_ru" character varying,
                               "question_fr" character varying,
                               "question_it" character varying,
                               "categoryId"  uuid      NOT NULL,
                               "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
                               "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
                               CONSTRAINT "PK_9451069b6f1199730791a7f4ae4" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "card_preference"
                             (
                               "id"                uuid                                   NOT NULL DEFAULT uuid_generate_v4(),
                               "profileId"         uuid                                   NOT NULL,
                               "cardId"            uuid                                   NOT NULL,
                               "status"            "public"."card_preference_status_enum" NOT NULL DEFAULT 'active',
                               "lastInteractionAt" TIMESTAMP                              NOT NULL DEFAULT now(),
                               CONSTRAINT "PK_d78f79e5362414dd5e4b0681c4a" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "profile"
                             (
                               "id"     uuid              NOT NULL DEFAULT uuid_generate_v4(),
                               "name"   character varying NOT NULL,
                               "userId" uuid              NOT NULL,
                               CONSTRAINT "PK_3dd8bfc97e4a77c70971591bdcb" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "user"
                             (
                               "id"          uuid              NOT NULL DEFAULT uuid_generate_v4(),
                               "email"       character varying NOT NULL,
                               "password"    character varying NOT NULL,
                               "name"        character varying NOT NULL,
                               "isActivated" boolean           NOT NULL DEFAULT true,
                               "isAdmin"     boolean           NOT NULL DEFAULT false,
                               "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
                               CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"),
                               CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`ALTER TABLE "suggestion"
      ADD CONSTRAINT "FK_7536b25ecdb34050f9d4b841fd0" FOREIGN KEY ("categoryId") REFERENCES "category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "suggestion"
      ADD CONSTRAINT "FK_bc709ea906afb2315940db65096" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "card"
      ADD CONSTRAINT "FK_14973cece7b39a867065f6c3fda" FOREIGN KEY ("categoryId") REFERENCES "category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "card_preference"
      ADD CONSTRAINT "FK_54a038ef2f0aac3f1b3b33c9336" FOREIGN KEY ("profileId") REFERENCES "profile" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "card_preference"
      ADD CONSTRAINT "FK_984734e01b62a9d58c5267ff89c" FOREIGN KEY ("cardId") REFERENCES "card" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "profile"
      ADD CONSTRAINT "FK_a24972ebd73b106250713dcddd9" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profile"
      DROP CONSTRAINT "FK_a24972ebd73b106250713dcddd9"`);
    await queryRunner.query(`ALTER TABLE "card_preference"
      DROP CONSTRAINT "FK_984734e01b62a9d58c5267ff89c"`);
    await queryRunner.query(`ALTER TABLE "card_preference"
      DROP CONSTRAINT "FK_54a038ef2f0aac3f1b3b33c9336"`);
    await queryRunner.query(`ALTER TABLE "card"
      DROP CONSTRAINT "FK_14973cece7b39a867065f6c3fda"`);
    await queryRunner.query(`ALTER TABLE "suggestion"
      DROP CONSTRAINT "FK_bc709ea906afb2315940db65096"`);
    await queryRunner.query(`ALTER TABLE "suggestion"
      DROP CONSTRAINT "FK_7536b25ecdb34050f9d4b841fd0"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "profile"`);
    await queryRunner.query(`DROP TABLE "card_preference"`);
    await queryRunner.query(`DROP TABLE "card"`);
    await queryRunner.query(`DROP TABLE "category"`);
    await queryRunner.query(`DROP TABLE "suggestion"`);
  }
}
