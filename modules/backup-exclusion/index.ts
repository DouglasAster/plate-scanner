import { requireOptionalNativeModule } from 'expo';

type BackupExclusionModule = {
  excludeFromBackup(path: string): void;
};

// iOS only. Android backups are disabled app-wide in plugins/withPrivacy.js.
const native = requireOptionalNativeModule<BackupExclusionModule>('BackupExclusion');

/** Keeps a directory out of iCloud/computer backups. No-op where not needed. */
export function excludeFromBackup(path: string) {
  try {
    native?.excludeFromBackup(path);
  } catch (e) {
    console.warn('Could not exclude directory from backup', e);
  }
}
