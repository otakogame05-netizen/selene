/** Keep native operations alive until a normal window close can finish safely. */
export class PendingTasks {
  private readonly tasks = new Set<Promise<unknown>>();

  track<T>(task: Promise<T>): Promise<T> {
    this.tasks.add(task);
    void task.then(() => this.tasks.delete(task), () => this.tasks.delete(task));
    return task;
  }

  async wait(): Promise<void> {
    while (this.tasks.size) await Promise.allSettled([...this.tasks]);
  }
}
