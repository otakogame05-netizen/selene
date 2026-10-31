export type ReadMode = 'single' | 'double' | 'vertical' | 'webtoon';
export type Theme = 'dark' | 'light' | 'sepia';
export interface Book { id: string; title: string; series: string; chapter: string; source: string; format: string; cover: string; pageCount: number; page: number; completed: boolean; favorite: boolean; addedAt: number; lastRead: number | null }
export interface BookMetadata { title: string; series: string; chapter: string }
export interface BookPages { book: Book; pages: string[]; bookmarks: number[] }
export interface Settings { onlineSource: string; integratedEngine: boolean; theme: Theme; mode: ReadMode; direction: 'ltr' | 'rtl'; fit: 'width' | 'contain'; guardian: boolean; breakMinutes: number; suwayomiUrl: string; translationLanguage: string }
export const defaults: Settings = { onlineSource: '', integratedEngine: false, theme: 'dark', mode: 'single', direction: 'rtl', fit: 'contain', guardian: true, breakMinutes: 25, suwayomiUrl: 'http://127.0.0.1:4567', translationLanguage: 'pt-BR' };
export const modeLabels: Record<ReadMode, string> = { single: 'Página única', double: 'Página dupla', vertical: 'Vertical', webtoon: 'Webtoon' };
export function clampPage(page: number, count: number) { return Math.max(0, Math.min(Math.max(0, count - 1), Math.trunc(Number.isFinite(page) ? page : 0))); }
export function pageGroup(page: number, count: number, mode: ReadMode) { const start = clampPage(page, count); return count <= 0 ? [] : mode === 'double' && start + 1 < count ? [start, start + 1] : [start]; }
export function progress(book: Book) { return book.completed ? 100 : book.lastRead === null ? 0 : Math.round(((book.page + 1) / book.pageCount) * 100); }
export function normalizeSettings(value: unknown): Settings {
  const v = value && typeof value === 'object' ? value as Partial<Settings> : {};
  return { onlineSource: typeof v.onlineSource === 'string' && v.onlineSource.length <= 80 ? v.onlineSource : '', integratedEngine: v.integratedEngine === true, theme: ['dark','light','sepia'].includes(v.theme ?? '') ? v.theme! : defaults.theme, mode: ['single','double','vertical','webtoon'].includes(v.mode ?? '') ? v.mode! : defaults.mode, direction: v.direction === 'ltr' ? 'ltr' : 'rtl', fit: v.fit === 'width' ? 'width' : 'contain', guardian: typeof v.guardian === 'boolean' ? v.guardian : true, breakMinutes: typeof v.breakMinutes === 'number' && Number.isFinite(v.breakMinutes) ? Math.max(1, Math.min(180, Math.round(v.breakMinutes))) : 25, suwayomiUrl: typeof v.suwayomiUrl === 'string' ? v.suwayomiUrl : defaults.suwayomiUrl, translationLanguage: typeof v.translationLanguage === 'string' ? v.translationLanguage : 'pt-BR' };
}
