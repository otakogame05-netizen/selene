import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { defaults, normalizeSettings, type Book, type BookMetadata, type BookPages, type Settings } from '../domain';
import type { ImportReport } from '../importModel';
export const desktop = isTauri();
export const asset = (path: string) => desktop ? convertFileSrc(path) : path;
export const library = {
  list: () => desktop ? invoke<Book[]>('list_books') : Promise.resolve([]),
  import: (kind: 'folder' | 'cbz' | 'pdf') => invoke<Book | null>('import_book', { kind }),
  importBatch: () => invoke<ImportReport | null>('import_cbz_batch'),
  open: (id: string) => invoke<BookPages>('open_book', { id }),
  saveProgress: (id: string, page: number, completed: boolean) => invoke<void>('save_progress', { id, page, completed }),
  favorite: (id: string, favorite: boolean) => invoke<void>('set_favorite', { id, favorite }),
  remove: (id: string) => invoke<void>('remove_book', { id }),
  bookmark: (id: string, page: number, marked: boolean) => invoke<void>('set_bookmark', { id, page, marked }),
  updateMetadata: (id: string, metadata: BookMetadata) => invoke<void>('update_metadata', { id, metadata }),
  settings: async () => normalizeSettings(desktop ? await invoke<unknown>('get_settings') : JSON.parse(localStorage.getItem('yomi.settings') ?? JSON.stringify(defaults))),
  saveSettings: (settings: Settings) => desktop ? invoke<void>('save_settings', { value: settings }) : Promise.resolve(localStorage.setItem('yomi.settings', JSON.stringify(settings))),
};
