import { expect,it } from 'vitest';
import { pendingItems,type QueueSnapshot } from './queueStore';
import type { Book } from '../domain';
it('recovers interrupted items while skipping books committed before checkpoint',()=>{
  const queue:QueueSnapshot={server:'http://localhost:4567/',mangaId:42,title:'Teste',items:[{id:1,name:'1',status:'downloading'},{id:2,name:'2',status:'saved'},{id:3,name:'3',status:'failed',error:'Falhou'}]};
  const books=[{source:'suwayomi:http://localhost:4567/#manga:42:chapter:1'}] as Book[];
  expect(pendingItems(queue,books).map(item=>[item.id,item.status])).toEqual([[2,'queued'],[3,'queued']]);
  expect(queue.items[0].status).toBe('downloading');
  expect(pendingItems(queue,[{...books[0],format:'stream'}]).map(item=>item.id)).toEqual([1,2,3]);
});
