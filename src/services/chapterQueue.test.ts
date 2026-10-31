import { describe, it, expect } from 'vitest';
import { runChapterQueue } from './chapterQueue';
import { AUTH_REQUIRED } from './suwayomi';
import type { Book } from '../domain';
const book = {} as Book;
const entries = [1,2,3].map(id => ({ id, name: `Capítulo ${id}` }));
describe('chapter queue', () => {
  it('stops on authentication failure and preserves following chapters for login/retry',async()=>{
    const order:number[]=[];const result=await runChapterQueue(entries,{stopped:()=>false,changed:()=>{},download:async id=>{order.push(id);throw AUTH_REQUIRED;}});
    expect(order).toEqual([1]);expect(result.map(item=>item.status)).toEqual(['failed','notStarted','notStarted']);
  });
  it('keeps provider-specific fields out of the persistence contract',async()=>{
    const entry={id:1,name:'1',chapterNumber:1};
    const result=await runChapterQueue([entry],{stopped:()=>false,download:async()=>book,changed:()=>{}});
    expect(Object.keys(result[0]).sort()).toEqual(['id','name','status']);
  });
  it('stops before the next chapter if saving a checkpoint fails', async () => {
    const order:number[]=[];
    await expect(runChapterQueue(entries,{stopped:()=>false,download:async id=>{order.push(id);return book;},changed:async items=>{if(items[0].status==='saved')throw new Error('Disco indisponível');}})).rejects.toThrow('Disco indisponível');
    expect(order).toEqual([1]);
  });
  it('keeps order, continues after failure and publishes independent snapshots', async () => {
    const order: number[] = []; const snapshots: string[][] = [];
    const result = await runChapterQueue(entries, { stopped: () => false, changed: items => { snapshots.push(items.map(item => item.status)); }, download: async id => { order.push(id); if (id === 2) throw new Error('Fonte indisponível'); return book; } });
    expect(order).toEqual([1,2,3]); expect(result.map(item => item.status)).toEqual(['saved','failed','saved']); expect(result[1].error).toBe('Fonte indisponível'); expect(snapshots[0]).toEqual(['queued','queued','queued']);
  });
  it('cancellation stops following chapters and preserves completed ones', async () => {
    const order: number[] = [];
    const result = await runChapterQueue(entries, { stopped: () => false, changed: () => {}, download: async id => { order.push(id); if (id === 2) throw 'Download cancelado'; return book; } });
    expect(order).toEqual([1,2]); expect(result.map(item => item.status)).toEqual(['saved','cancelled','notStarted']);
  });
  it('a stop after commit preserves success and prevents the next download', async () => {
    let stop = false;
    const result = await runChapterQueue(entries, { stopped: () => stop, changed: () => {}, download: async () => { stop = true; return book; } });
    expect(result.map(item => item.status)).toEqual(['saved','notStarted','notStarted']);
  });
  it('rejects empty, duplicate or oversized selections before starting', async () => {
    let calls = 0;
    for (const selection of [[],[entries[0],entries[0]],Array.from({length:51},(_,id) => ({id,name:String(id)}))]) await expect(runChapterQueue(selection, { stopped: () => false, changed: () => {}, download: async () => { calls++; return book; } })).rejects.toThrow();
    expect(calls).toBe(0);
  });
});

