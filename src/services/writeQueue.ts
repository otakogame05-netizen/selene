/** Serialize disk writes while keeping failures observable to each caller. */
export class WriteQueue<T> {
  private tail: Promise<void> = Promise.resolve();
  private latest: { value: T } | undefined;

  constructor(private readonly write: (value: T) => Promise<void>) {}

  push(value: T): Promise<void> {
    this.latest = { value };
    const operation = this.tail.catch(() => undefined).then(() => this.write(value));
    this.tail = operation;
    return operation;
  }

  async flush(): Promise<void> {
    // Include writes queued while an earlier write is still in flight.
    for (;;) {
      const pending = this.tail;
      await pending;
      if (pending === this.tail) return;
    }
  }

  retry(): Promise<void> {
    return this.latest ? this.push(this.latest.value) : Promise.resolve();
  }
}
