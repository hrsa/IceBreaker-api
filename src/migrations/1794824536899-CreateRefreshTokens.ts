import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRefreshTokens1794824536899 implements MigrationInterface {
  name = "CreateRefreshTokens1794824536899";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "refresh_token"
                             (
                                 "id"        uuid              NOT NULL DEFAULT uuid_generate_v4(),
                                 "tokenHash" character varying NOT NULL,
                                 "familyId"  uuid              NOT NULL,
                                 "userId"    uuid              NOT NULL,
                                 "expiresAt" TIMESTAMP         NOT NULL,
                                 "createdAt" TIMESTAMP        NOT NULL DEFAULT now(),
                                 "rotatedAt" TIMESTAMP,
                                 "revokedAt" TIMESTAMP,
                                 CONSTRAINT "PK_7cc95f6dd98601cb5742eb4c3e6" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3a9f51cdcb389372a74243bfcc" ON "refresh_token" ("tokenHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_6f606e0771401238dcb06012ab" ON "refresh_token" ("familyId")`);
    await queryRunner.query(`CREATE INDEX "IDX_40771d50b2c1cc7f7be4d94a2b" ON "refresh_token" ("userId")`);
    await queryRunner.query(`ALTER TABLE "refresh_token"
        ADD CONSTRAINT "FK_40771d50b2c1cc7f7be4d94a2b0" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_40771d50b2c1cc7f7be4d94a2b0"`);
    await queryRunner.query(`DROP INDEX "IDX_40771d50b2c1cc7f7be4d94a2b"`);
    await queryRunner.query(`DROP INDEX "IDX_6f606e0771401238dcb06012ab"`);
    await queryRunner.query(`DROP INDEX "IDX_3a9f51cdcb389372a74243bfcc"`);
    await queryRunner.query(`DROP TABLE "refresh_token"`);
  }
}
