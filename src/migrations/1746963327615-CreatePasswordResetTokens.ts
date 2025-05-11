import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePasswordResetTokens1746963327615 implements MigrationInterface {
  name = "CreatePasswordResetTokens1746963327615";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "password_reset"
                             (
                                 "id"        uuid              NOT NULL DEFAULT uuid_generate_v4(),
                                 "token"     character varying NOT NULL,
                                 "userId"    uuid              NOT NULL,
                                 "expiresAt" TIMESTAMP         NOT NULL,
                                 "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
                                 "used"      boolean           NOT NULL DEFAULT false,
                                 CONSTRAINT "PK_8515e60a2cc41584fa4784f52ce" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`ALTER TABLE "password_reset"
        ADD CONSTRAINT "FK_05baebe80e9f8fab8207eda250c" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "password_reset"
        DROP CONSTRAINT "FK_05baebe80e9f8fab8207eda250c"`);
    await queryRunner.query(`DROP TABLE "password_reset"`);
  }
}
