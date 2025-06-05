export type UploadProviderType = "google-drive" | "s3";

export interface UploadProvider {
  upload(filepath: string, fileName: string, remoteDirectory?: string): Promise<UploadResult>;
  delete?(fileId: string): Promise<boolean>;
  list?(directory?: string): Promise<CloudFile[]>;
  cleanup?(retentionDays: number, directory?: string): Promise<CleanupResult>;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  fileId?: string;
  message?: string;
  provider?: UploadProviderType;
}

export interface CloudFile {
  id: string;
  name: string;
  createdAt: Date;
  size?: number;
  url?: string;
}

export interface CleanupResult {
  deletedCount: number;
  totalSize?: number;
  deletedFiles: string[];
  errors: string[];
  provider: UploadProviderType;
}