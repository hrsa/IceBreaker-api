import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreditsToUsers1746791069432 implements MigrationInterface {
  name = "AddCreditsToUsers1746791069432";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "credits" integer NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "credits"`);
  }
}
