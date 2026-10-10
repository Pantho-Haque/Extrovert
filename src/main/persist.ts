/** Small JSON files in the app's data folder, written atomically and debounced. */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class JsonFile<T> {
  private timer: NodeJS.Timeout | undefined;
  private pending: T | undefined;

  constructor(
    private readonly path: string,
    private readonly parse: (raw: unknown) => T,
  ) {}

  read(): T {
    try {
      return this.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    } catch {
      return this.parse(undefined); // missing or corrupt: start from defaults
    }
  }

  /** Saves after a short pause, so bursts of changes cost one write. */
  write(value: T): void {
    this.pending = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }

  flush(): void {
    clearTimeout(this.timer);
    if (this.pending === undefined) return;
    mkdirSync(dirname(this.path), { recursive: true });
    // Write a temp file then rename: a crash mid-write never leaves a half-written file.
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.pending), { mode: 0o600 });
    renameSync(tmp, this.path);
    this.pending = undefined;
  }
}
