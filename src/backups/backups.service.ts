import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync, mkdirSync } from "fs";
import { CleanupResult, UploadProvider, UploadProviderType, UploadResult } from "./interfaces/upload-provider.interface";
import { GoogleDriveProvider } from "./providers/google-drive.provider";
import { S3Provider } from "./providers/s3.provider";
import * as path from 'node:path';
import { readdir, unlink } from 'node:fs/promises';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly backupDir: string;
  private providers: Map<UploadProviderType, UploadProvider> = new Map();

  constructor(
    private configService: ConfigService,
    private googleDriveProvider: GoogleDriveProvider,
    private s3Provider: S3Provider
  ) {
    this.backupDir = this.configService.get<string>("BACKUP_DIR", "/app/backups");
    this.ensureBackupDirExists();
    this.providers.set("google-drive", this.googleDriveProvider);
    this.providers.set("s3", this.s3Provider);
  }

  private ensureBackupDirExists() {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
      this.logger.log(`Created backup directory ${this.backupDir}`);
    }
  }

  private getDefaultProvider(): UploadProviderType {
    return this.configService.get<UploadProviderType>("BACKUP_UPLOAD_PROVIDER", "google-drive");
  }
  
  private async getBackupFiles(directory: string): Promise<string[]> {
    try {
      const files = await readdir(directory);
      const backupFiles = files.filter((file) => file.endsWith(".sql") || file.endsWith(".sql.gz"));
      return backupFiles.map(file => path.join(directory, file));
    } catch (error) {
      this.logger.error("Failed to get backup files:", error.message);
      return [];
    }
    
  }

  async bulkUpload(providerType?: UploadProviderType, remoteDirectory?: string): Promise<UploadResult[]> {
      const files = await this.getBackupFiles(this.backupDir);

      if (files.length === 0) {
        this.logger.log("No backup files found");
        return [];
      }
      
      this.logger.log(`Uploading ${files.length} backup files...`);

      let providers: UploadProviderType[] = ["google-drive", "s3"];
      if (providerType) {
         providers = [providerType];
      }
      
      const results: UploadResult[] = [];
      for (const file of files) {
          try {
            for (const provider of providers) {
              this.logger.log(`Uploading ${file} to ${provider}...`);
              const result = await this.upload(file, path.basename(file), provider, remoteDirectory);
              results.push(result);

              if (result.success) {
                this.logger.log(`✅ Uploaded ${file} to ${provider}`);
              } else {
                this.logger.error(`❌ Failed to upload ${file} to ${provider}`);
              }
            }
            await unlink(file);
            this.logger.log(`🗑️ Deleted ${file}`);
          } catch (error) {
            const failureResult: UploadResult = {
              success: false,
              message: `Failed to upload ${file}: ${error.message}`,
            };
            results.push(failureResult);
            this.logger.error(`❌ ${failureResult.message}`);

          }
        }
      return results;
  }

  async upload(filePath: string, fileName: string, providerType?: UploadProviderType, remoteDirectory?: string): Promise<UploadResult> {
    const provider = providerType || this.getDefaultProvider();
    const uploadProvider = this.providers.get(provider);

    if (!uploadProvider) {
      throw new Error(`Upload provider '${provider}' not found`);
    }

    this.logger.log(`Using ${provider} provider for upload to directory: ${remoteDirectory}`);

    return await uploadProvider.upload(filePath, fileName, remoteDirectory);
  }

  async cleanupCloudBackups(retentionDays?: number, providerType?: UploadProviderType, directory?: string): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];
    const providersToClean = providerType ? [providerType] : Array.from(this.providers.keys());
    retentionDays = retentionDays || this.configService.getOrThrow<number>("BACKUP_RETENTION_DAYS");

    for (const provider of providersToClean) {
      const uploadProvider = this.providers.get(provider);
      if (uploadProvider?.cleanup) {
        this.logger.log(`Cleaning up ${provider} backups older than ${retentionDays} days...`);
        try {
          const result = await uploadProvider.cleanup(retentionDays, directory);
          results.push({ ...result, provider });
        } catch (error) {
          results.push({
            deletedCount: 0,
            totalSize: 0,
            deletedFiles: [],
            errors: [`Cleanup failed for ${provider}: ${error.message}`],
            provider,
          });
        }
      }
    }

    return results;
  }
}
