import { Injectable, Logger } from "@nestjs/common";
import { CleanupResult, CloudFile, UploadProvider, UploadResult } from "../interfaces/upload-provider.interface";
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { createReadStream, statSync } from "fs";
import { basename } from "path";

@Injectable()
export class S3Provider implements UploadProvider {
  private readonly logger = new Logger(S3Provider.name);
  private s3Client: S3Client;
  private bucketName: string;
  private basePrefix: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>("AWS_S3_BUCKET_NAME", "");
    this.basePrefix = this.configService.get<string>("AWS_S3_BASE_PREFIX", "");
    this.initializeS3();
  }

  private initializeS3() {
    try {
      this.s3Client = new S3Client({
        region: this.configService.get<string>("AWS_REGION", "us-east-1"),
        credentials: {
          accessKeyId: this.configService.getOrThrow<string>("AWS_ACCESS_KEY_ID"),
          secretAccessKey: this.configService.getOrThrow<string>("AWS_SECRET_ACCESS_KEY"),
        },
      });
      this.logger.log("S3 client initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize S3:", error.message);
    }
  }

  async upload(filePath: string, fileName?: string, remoteDirectory?: string): Promise<UploadResult> {
    try {
      if (!this.s3Client || !this.bucketName) {
        throw new Error("S3 not properly configured");
      }

      let key = this.basePrefix;
      if (remoteDirectory) {
        key += `/${remoteDirectory}`;
      }
      key += `/${fileName || basename(filePath)}`;
      const fileStream = createReadStream(filePath);
      const fileSize = statSync(filePath).size;

      this.logger.log(`Uploading ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB) to S3: ${key}`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileStream,
        ContentType: "application/octet-stream",
        Metadata: {
          "upload-date": new Date().toISOString(),
          "original-name": basename(filePath),
        },
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

      return {
        success: true,
        fileId: key,
        url: url,
        message: `Successfully uploaded to S3: ${key}`,
        provider: "s3",
      };
    } catch (error) {
      this.logger.error("S3 upload failed:", error.message);
      return {
        success: false,
        message: `S3 upload failed: ${error.message}`,
        provider: "s3",
      };
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      this.logger.error("Failed to delete from S3:", error.message);
      throw error;
    }
  }

  async list(directory?: string): Promise<CloudFile[]> {
    try {
      let prefix = `${this.basePrefix}`;
      if (directory) {
        prefix += `/${directory}`;
      }

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      return (response.Contents || [])
        .filter(obj => obj.Key!.includes("backup_"))
        .map(obj => ({
          id: obj.Key!,
          name: basename(obj.Key!),
          createdAt: obj.LastModified || new Date(),
          size: obj.Size || 0,
          url: `https://${this.bucketName}.s3.amazonaws.com/${obj.Key}`,
        }));
    } catch (error) {
      this.logger.error("Failed to list S3 files:", error.message);
      return [];
    }
  }

  async cleanup(retentionDays: number, directory?: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      totalSize: 0,
      deletedFiles: [],
      errors: [],
      provider: "s3",
    };

    try {
      const files = await this.list(directory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      this.logger.log(`S3 cleanup: checking ${files.length} files older than ${cutoffDate.toISOString()}`);

      for (const file of files) {
        if (file.createdAt < cutoffDate) {
          try {
            await this.delete(file.id);
            result.deletedCount++;
            result.totalSize! += file.size || 0;
            result.deletedFiles.push(file.name);
            this.logger.log(`Deleted old backup from S3: ${file.name}`);
          } catch (error) {
            const errorMsg = `Failed to delete ${file.name}: ${error.message}`;
            result.errors.push(errorMsg);
            this.logger.error(errorMsg);
          }
        }
      }

      this.logger.log(
        `S3 cleanup completed: deleted ${result.deletedCount} files, freed ${(result.totalSize! / 1024 / 1024).toFixed(2)} MB`
      );
      return result;
    } catch (error) {
      this.logger.error("S3 cleanup failed:", error.message);
      result.errors.push(`Cleanup failed: ${error.message}`);
      return result;
    }
  }
}
