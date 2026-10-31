import type { Book } from '../domain';
import { AUTH_REQUIRED } from './suwayomi';
export type QueueStatus = 'queued' | 'downloading' | 'saved' | 'failed' | 'cancelled' | 'notStarted';
export interface QueueItem { id: number; name: string; status: QueueStatus; error?: string | null }
export const queueLabels: Record<QueueStatus, string> = { queued: 'Aguardando', downloading: 'Baixando', saved: 'Salvo', failed: 'Falhou', cancelled: 'Cancelado', notStarted: 'Não iniciado' };

/** One request at a time; completed chapters survive a later failure or stop. */
export async function runChapterQueue(entries: { id: number; name: string }[], options: {
  download: (id: number) => Promise<Book>;
  stopped: () => boolean;
  changed: (items: QueueItem[]) => void | Promise<void>;
}): Promise<QueueItem[]> {
  if (!entries.length || entries.length > 50 || new Set(entries.map(item => item.id)).size !== entries.length) throw new Error('Selecione entre 1 e 50 capítulos diferentes.');
  const items: QueueItem[] = entries.map(item => ({ id:item.id,name:item.name,status:'queued' }));
  const publish = async () => { await options.changed(items.map(item => ({ ...item }))); };
  await publish();
  for (const item of items) {
    if (options.stopped()) break;
    item.status = 'downloading'; await publish();
    try { await options.download(item.id); item.status = 'saved'; }
    catch (error) {
      if (String(error) === 'Download cancelado') { item.status = 'cancelled'; await publish(); break; }
      item.status = 'failed'; item.error = error instanceof Error ? error.message : String(error);
      if(item.error===AUTH_REQUIRED){await publish();break;}
    }
    await publish();
  }
  for (const item of items) if (item.status === 'queued') item.status = 'notStarted';
  await publish(); return items;
}

