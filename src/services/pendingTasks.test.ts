import { expect, it } from 'vitest';
import { PendingTasks } from './pendingTasks';

it('aguarda operações novas iniciadas durante uma operação pendente', async () => {
  const tasks = new PendingTasks();
  let first!: () => void;
  let second!: () => void;
  tasks.track(new Promise<void>(resolve => { first = resolve; }));
  let done = false;
  const waiting = tasks.wait().then(() => { done = true; });
  tasks.track(new Promise<void>(resolve => { second = resolve; }));
  first();
  await Promise.resolve();
  expect(done).toBe(false);
  second();
  await waiting;
  expect(done).toBe(true);
});

it('não deixa uma operação já rejeitada impedir todo fechamento futuro', async () => {
  const tasks = new PendingTasks();
  const failure = tasks.track(Promise.reject(new Error('Falha já apresentada pela interface')));
  await expect(failure).rejects.toThrow();
  await expect(tasks.wait()).resolves.toBeUndefined();
});
