import { Module } from "@nestjs/common";
import { BackupsService } from "./backups.service";
import { GoogleDriveProvider } from './providers/google-drive.provider';
import { S3Provider } from './providers/s3.provider';

@Module({
  providers: [BackupsService, GoogleDriveProvider, S3Provider],
  exports: [BackupsService],
})
export class BackupsModule {}
