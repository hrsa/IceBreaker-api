import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicAndUserToCategories1746778449821 implements MigrationInterface {
    name = 'AddPublicAndUserToCategories1746778449821'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "category" ADD "isPublic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "category" ADD "userId" uuid`);
        await queryRunner.query(`ALTER TABLE "category" ADD CONSTRAINT "FK_32b856438dffdc269fa84434d9f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "category" DROP CONSTRAINT "FK_32b856438dffdc269fa84434d9f"`);
        await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "isPublic"`);
    }

}
