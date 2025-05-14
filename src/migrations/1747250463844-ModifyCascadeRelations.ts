import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyCascadeRelations1747250463844 implements MigrationInterface {
    name = 'ModifyCascadeRelations1747250463844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "suggestion" DROP CONSTRAINT "FK_bc709ea906afb2315940db65096"`);
        await queryRunner.query(`ALTER TABLE "card" DROP CONSTRAINT "FK_14973cece7b39a867065f6c3fda"`);
        await queryRunner.query(`ALTER TABLE "card_preference" DROP CONSTRAINT "FK_54a038ef2f0aac3f1b3b33c9336"`);
        await queryRunner.query(`ALTER TABLE "card_preference" DROP CONSTRAINT "FK_984734e01b62a9d58c5267ff89c"`);
        await queryRunner.query(`ALTER TABLE "profile" DROP CONSTRAINT "FK_a24972ebd73b106250713dcddd9"`);
        await queryRunner.query(`ALTER TABLE "suggestion" ADD CONSTRAINT "FK_bc709ea906afb2315940db65096" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "card" ADD CONSTRAINT "FK_14973cece7b39a867065f6c3fda" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "card_preference" ADD CONSTRAINT "FK_54a038ef2f0aac3f1b3b33c9336" FOREIGN KEY ("profileId") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "card_preference" ADD CONSTRAINT "FK_984734e01b62a9d58c5267ff89c" FOREIGN KEY ("cardId") REFERENCES "card"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "profile" ADD CONSTRAINT "FK_a24972ebd73b106250713dcddd9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profile" DROP CONSTRAINT "FK_a24972ebd73b106250713dcddd9"`);
        await queryRunner.query(`ALTER TABLE "card_preference" DROP CONSTRAINT "FK_984734e01b62a9d58c5267ff89c"`);
        await queryRunner.query(`ALTER TABLE "card_preference" DROP CONSTRAINT "FK_54a038ef2f0aac3f1b3b33c9336"`);
        await queryRunner.query(`ALTER TABLE "card" DROP CONSTRAINT "FK_14973cece7b39a867065f6c3fda"`);
        await queryRunner.query(`ALTER TABLE "suggestion" DROP CONSTRAINT "FK_bc709ea906afb2315940db65096"`);
        await queryRunner.query(`ALTER TABLE "profile" ADD CONSTRAINT "FK_a24972ebd73b106250713dcddd9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_preference" ADD CONSTRAINT "FK_984734e01b62a9d58c5267ff89c" FOREIGN KEY ("cardId") REFERENCES "card"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_preference" ADD CONSTRAINT "FK_54a038ef2f0aac3f1b3b33c9336" FOREIGN KEY ("profileId") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card" ADD CONSTRAINT "FK_14973cece7b39a867065f6c3fda" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "suggestion" ADD CONSTRAINT "FK_bc709ea906afb2315940db65096" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
