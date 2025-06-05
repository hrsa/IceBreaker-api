import { Injectable, Logger } from "@nestjs/common";
import { CleanupResult, CloudFile, UploadProvider, UploadResult } from "../interfaces/upload-provider.interface";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
import { basename } from "path";
import { createReadStream, statSync } from "fs";

@Injectable()
export class GoogleDriveProvider implements UploadProvider {
  private readonly logger = new Logger(GoogleDriveProvider.name);
  private drive: any;
  private baseFolderId: string;

  constructor(private configService: ConfigService) {
    this.baseFolderId = this.configService.get<string>("GOOGLE_DRIVE_FOLDER_ID", "");
    this.initializeGoogleDrive();
  }

  private initializeGoogleDrive() {
    try {
      const credentials = JSON.parse(this.configService.get<string>("GOOGLE_DRIVE_CREDENTIALS", "{}"));

      const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/drive"] });
      this.drive = google.drive({ version: "v3", auth });
      this.logger.log("Google Drive initialized");
    } catch (error) {
      this.logger.error("Google Drive initialization failed", error.stack);
    }
  }

  async upload(filepath: string, fileName: string, remoteDirectory?: string): Promise<UploadResult> {
    try {
      if (!this.drive) {
        throw new Error("Google Drive not initialized");
      }

      if (remoteDirectory) {
        this.baseFolderId = await this.getOrCreateFolder(remoteDirectory);
      }
      const fileMetadata = {
        name: fileName || basename(filepath),
        parents: [this.baseFolderId],
      };

      const media = {
        mimeType: "application/zip",
        body: createReadStream(filepath),
      };

      const fileSize = statSync(filepath).size;
      this.logger.log(
        `Uploading ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB) to Google Drive folder: ${remoteDirectory || "icemelter-backups"}`
      );

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id,name,webViewLink",
      });

      return {
        success: true,
        fileId: response.data.id,
        url: response.data.webViewLink,
        message: `Successfully uploaded to Google Drive: ${response.data.name}`,
        provider: "google-drive",
      } as UploadResult;
    } catch (e) {
      this.logger.error(`Failed to upload file ${fileName} to Google Drive: ${e.message}`, e.stack);
      return {
        success: false,
        message: `Failed to upload file ${fileName} to Google Drive: ${e.message}`,
        provider: "google-drive",
      } as UploadResult;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (error) {
      this.logger.error("Failed to delete from Google Drive:", error.message);
      throw error;
    }
  }

  async list(directory?: string): Promise<CloudFile[]> {
    try {
      if (directory) {
        this.baseFolderId = await this.getOrCreateFolder(directory || "backups");
      }

      const response = await this.drive.files.list({
        q: `'${this.baseFolderId}' in parents and name contains 'backup_' and trashed=false`,
        fields: "files(id,name,createdTime,size,webViewLink)",
        orderBy: "createdTime desc",
      });

      return (response.data.files || []).map(file => ({
        id: file.id,
        name: file.name,
        createdAt: new Date(file.createdTime),
        size: parseInt(file.size) || 0,
        url: file.webViewLink,
      }));
    } catch (error) {
      this.logger.error("Failed to list Google Drive files:", error.message);
      return [];
    }
  }

  async cleanup(retentionDays: number, directory?: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      totalSize: 0,
      deletedFiles: [],
      errors: [],
      provider: "google-drive",
    };

    try {
      const files = await this.list(directory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      this.logger.log(`Google Drive cleanup: checking ${files.length} files older than ${cutoffDate.toISOString()}`);

      for (const file of files) {
        if (file.createdAt < cutoffDate) {
          try {
            await this.delete(file.id);
            result.deletedCount++;
            result.totalSize! += file.size || 0;
            result.deletedFiles.push(file.name);
            this.logger.log(`Deleted old backup from Google Drive: ${file.name}`);
          } catch (error) {
            const errorMsg = `Failed to delete ${file.name}: ${error.message}`;
            result.errors.push(errorMsg);
            this.logger.error(errorMsg);
          }
        }
      }

      this.logger.log(
        `Google Drive cleanup completed: deleted ${result.deletedCount} files, freed ${(result.totalSize! / 1024 / 1024).toFixed(2)} MB`
      );
      return result;
    } catch (error) {
      this.logger.error("Google Drive cleanup failed:", error.message);
      result.errors.push(`Cleanup failed: ${error.message}`);
      return result;
    }
  }

  private async getOrCreateFolder(folderName: string): Promise<string> {
    if (!folderName || folderName === "/") {
      return this.baseFolderId;
    }

    try {
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${this.baseFolderId}' in parents and trashed=false`,
        fields: "files(id,name)",
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      const folderMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [this.baseFolderId],
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: "id",
      });

      this.logger.log(`Created Google Drive folder: ${folderName}`);
      return folder.data.id;
    } catch (error) {
      this.logger.error(`Failed to get/create folder ${folderName}:`, error.message);
      return this.baseFolderId;
    }
  }
}
