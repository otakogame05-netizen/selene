import { invoke } from '@tauri-apps/api/core';

export interface RestorePreview {
  token: string;
  createdAt: number;
  matched: number;
  skipped: number;
  settingsIncluded: boolean;
  organizationIncluded: boolean;
  rows: { title: string; matched: boolean; reason: string }[];
}
export interface RestoreResult {
  restored: number;
  skipped: number;
  settingsRestored: boolean;
  organizationRestored: boolean;
  recoveryPath: string;
}

export const backup = {
  export: () => invoke<string | null>('export_reading_backup'),
  preview: () => invoke<RestorePreview | null>('preview_reading_restore'),
  apply: (token: string, includeSettings: boolean) => invoke<RestoreResult>('apply_reading_restore', { token, includeSettings }),
  cancel: (token: string) => invoke<void>('cancel_reading_restore', { token }),
};
