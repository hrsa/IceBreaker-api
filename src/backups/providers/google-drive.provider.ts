import { Injectable, Logger } from "@nestjs/common";
import { CleanupResult, CloudFile, UploadProvider, UploadResult } from "../interfaces/upload-provider.interface";
import { ConfigService } from "@nestjs/config";
import { google, drive_v3 } from "googleapis";

import { basename } from "path";
import { createReadStream, statSync } from "fs";
import { getErrorMessage, getErrorStack } from "../../common/utils/error.utils";

@Injectable()
export class GoogleDriveProvider implements UploadProvider {
  private readonly logger = new Logger(GoogleDriveProvider.name);
  private drive?: drive_v3.Drive;
  private baseFolderId: string;

  constructor(private configService: ConfigService) {
    this.baseFolderId = this.configService.get<string>("GOOGLE_DRIVE_FOLDER_ID", "");
    this.initializeGoogleDrive();
  }

  private initializeGoogleDrive() {
    try {
      const credentials = JSON.parse(this.configService.get<string>("GOOGLE_DRIVE_CREDENTIALS", "{}")) as { client_email: string; private_key: string };

      const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/drive"] });
      this.drive = google.drive({ version: "v3", auth });
      this.logger.log("Google Drive initialized");
    } catch (error) {
      this.logger.error("Google Drive initialization failed", getErrorStack(error));
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
        requestBody: fileMetadata,
        media: media,
        fields: "id,name,webViewLink",
      });

      return {
        success: true,
        fileId: response.data.id ?? undefined,
        url: response.data.webViewLink ?? undefined,
        message: `Successfully uploaded to Google Drive: ${response.data.name}`,
        provider: "google-drive",
      };
    } catch (e) {
      const message = getErrorMessage(e);
      this.logger.error(`Failed to upload file ${fileName} to Google Drive: ${message}`, getErrorStack(e));
      return {
        success: false,
        message: `Failed to upload file ${fileName} to Google Drive: ${message}`,
        provider: "google-drive",
      };
    }
  }

  async delete(fileId: string): Promise<boolean> {
    if (!this.drive) {
      throw new Error("Google Drive not initialized");
    }
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (error) {
      this.logger.error("Failed to delete from Google Drive:", getErrorMessage(error));
      throw error;
    }
  }

  async list(directory?: string): Promise<CloudFile[]> {
    if (!this.drive) {
      this.logger.error("Failed to list Google Drive files: Google Drive not initialized");
      return [];
    }

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
        id: file.id || "",
        name: file.name || "",
        createdAt: new Date(file.createdTime || Date.now()),
        size: parseInt(file.size || "0") || 0,
        url: file.webViewLink ?? undefined,
      }));
    } catch (error) {
      this.logger.error("Failed to list Google Drive files:", getErrorMessage(error));
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
            const errorMsg = `Failed to delete ${file.name}: ${getErrorMessage(error)}`;
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
      this.logger.error("Google Drive cleanup failed:", getErrorMessage(error));
      result.errors.push(`Cleanup failed: ${getErrorMessage(error)}`);
      return result;
    }
  }

  private async getOrCreateFolder(folderName: string): Promise<string> {
    if (!this.drive) {
      return this.baseFolderId;
    }
    if (!folderName || folderName === "/") {
      return this.baseFolderId;
    }

    try {
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${this.baseFolderId}' in parents and trashed=false`,
        fields: "files(id,name)",
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id ?? this.baseFolderId;
      }

      const folderMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [this.baseFolderId],
      };

      const folder = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: "id",
      });

      this.logger.log(`Created Google Drive folder: ${folderName}`);
      return folder.data.id ?? this.baseFolderId;
    } catch (error) {
      this.logger.error(`Failed to get/create folder ${folderName}:`, getErrorMessage(error));
      return this.baseFolderId;
    }
  }
}
