import { CommandRunner } from "nest-commander";
import { Command } from "nest-commander";
import { BackupsService } from "../backups/backups.service";
import { UploadProviderType } from "../backups/interfaces/upload-provider.interface";

@Command({
  name: "backup",
  description: "Database backup operations",
  arguments: "<action> [provider] [days]",
  argsDescription: {
    action: "Action: upload, cleanup",
    provider: "Upload provider: google-drive, s3 (optional - uploads to all if not specified)",
    days: "Retention days for cleanup (optional, default: 7)",
  },
})
export class BackupCommand extends CommandRunner {
  constructor(
    private readonly backupsService: BackupsService,
  ) {
    super();
  }

  async run(inputs: string[], options?: Record<string, string>): Promise<void> {
    const [action, provider, days] = inputs;

    try {
      switch (action) {
        case "upload":
          await this.backupsService.bulkUpload(provider as UploadProviderType);
          console.log("✅ Upload complete");
          break;
        case "cleanup":
          await this.backupsService.cleanupCloudBackups(parseInt(days), provider as UploadProviderType);
          console.log("✅ Cleanup complete");
          break;
        default:
          console.error("Error: Unknown action");
          console.log("Available actions:");
          console.log("  upload [provider] [directory]   - Upload all backup files");
          console.log("  cleanup [provider] [days]       - Cleanup old backups (default: 7 days)");
          process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  }
}
