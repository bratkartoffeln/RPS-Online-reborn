/** Reveal and announce the next turn together, after effects and a quiet second. */
export class RefereeDelay {
  waiting = false;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  cancel(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.waiting = false;
  }

  schedule(settled: () => Promise<void>, reveal: () => void, quietMs = 1000): void {
    this.cancel();
    const generation = this.generation;
    this.waiting = true;
    // Rendering the snapshot starts the board effect before we inspect it.
    void Promise.resolve().then(settled).then(() => {
      if (generation !== this.generation) return;
      this.timer = setTimeout(() => {
        if (generation !== this.generation) return;
        this.timer = undefined;
        this.waiting = false;
        reveal();
      }, quietMs);
    });
  }
}
