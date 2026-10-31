import { describe, expect, it } from 'vitest';
import { WriteQueue } from './writeQueue';

describe('gravações persistentes', () => {
  it('aguarda a gravação anterior e preserva a ordem das páginas', async () => {
    const writes: number[] = [];
    let release!: () => void;
    const first = new Promise<void>(resolve => { release = resolve; });
    const queue = new WriteQueue<number>(async page => {
      if (page === 1) await first;
      writes.push(page);
    });
    const one = queue.push(1);
    const two = queue.push(2);
    await Promise.resolve();
    expect(writes).toEqual([]);
    release();
    await Promise.all([one, two, queue.flush()]);
    expect(writes).toEqual([1, 2]);
  });

  it('propaga a falha e permite salvar novamente sem reiniciar o leitor', async () => {
    const writes: number[] = [];
    const queue = new WriteQueue<number>(async page => {
      if (page === 1) throw new Error('Disco indisponível');
      writes.push(page);
    });
    await expect(queue.push(1)).rejects.toThrow('Disco indisponível');
    await expect(queue.flush()).rejects.toThrow('Disco indisponível');
    await queue.push(2);
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(writes).toEqual([2]);
  });

  it('repete a configuração mais recente após uma falha temporária', async () => {
    let fail = true;
    const values: string[] = [];
    const queue = new WriteQueue<string>(async value => {
      if (fail) throw new Error('Temporário');
      values.push(value);
    });
    await expect(queue.push('sepia')).rejects.toThrow('Temporário');
    fail = false;
    await queue.retry();
    expect(values).toEqual(['sepia']);
  });

  it('aguarda uma gravação adicionada enquanto o fechamento já está aguardando', async () => {
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const first = new Promise<void>(resolve => { releaseFirst = resolve; });
    const second = new Promise<void>(resolve => { releaseSecond = resolve; });
    const queue = new WriteQueue<number>(value => value === 1 ? first : second);
    const one = queue.push(1);
    let flushed = false;
    const flushing = queue.flush().then(() => { flushed = true; });
    const two = queue.push(2);
    releaseFirst();
    await one;
    await Promise.resolve();
    expect(flushed).toBe(false);
    releaseSecond();
    await Promise.all([two, flushing]);
    expect(flushed).toBe(true);
  });
});
