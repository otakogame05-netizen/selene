import { invoke } from '@tauri-apps/api/core';
import type { Book } from '../domain';
import { chapterSource } from './suwayomi';
import type { QueueItem } from './chapterQueue';
export interface QueueSnapshot { server:string; mangaId:number; title:string; items:QueueItem[] }
export interface QueueRecord { revision:number; queue:QueueSnapshot | null }
export const queueStore = {
  load: () => invoke<QueueRecord>('get_saved_queue'),
  save: (expectedRevision:number,queue:QueueSnapshot | null) => invoke<QueueRecord>('save_download_queue',{expectedRevision,queue}),
};
export function pendingItems(queue:QueueSnapshot,books:Book[]):QueueItem[] {
  return queue.items.filter(item => !books.some(book => book.format !== 'stream' && book.source === chapterSource(queue.server,queue.mangaId,item.id)))
    .map(item => ({id:item.id,name:item.name,status:'queued'}));
}
