/** Release one CPU turn only after the local presentation has really finished. */
export class CpuTurnGate {
  private key: string | null = null;
  private generation = 0;
  private waiting = false;
  private sent = false;

  update(key: string | null, busy: boolean, settled: () => Promise<void>, send: () => boolean): void {
    if (key !== this.key) {
      this.key = key;
      this.generation++;
      this.waiting = false;
      this.sent = false;
    }
    if (!key || this.sent) return;
    if (busy) {
      this.generation++;
      this.waiting = false;
      return;
    }
    if (this.waiting) return;
    this.waiting = true;
    const generation = this.generation;
    // Start after playCue has registered its playback promise, including muted audio.
    void Promise.resolve().then(settled).then(() => {
      if (generation !== this.generation) return;
      this.waiting = false;
      this.sent = send();
    });
  }
}
