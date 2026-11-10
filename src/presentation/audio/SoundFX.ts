type VentanaConWebkit = Window & { webkitAudioContext?: typeof AudioContext };

export class SoundFX {
  private ctx: AudioContext | null = null;
  private muted = false;

  init(): void {
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ?? (window as VentanaConWebkit).webkitAudioContext;
      if (AudioCtor) this.ctx = new AudioCtor();
    }
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(
    freq = 440,
    duration = 0.12,
    type: OscillatorType = 'sine',
    volume = 0.12,
    slideTo: number | null = null
  ): void {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      return;
    }
  }

  select(): void {
    this.playTone(520, 0.09, 'triangle', 0.14, 680);
  }

  jump(): void {
    this.playTone(260, 0.16, 'sine', 0.14, 580);
  }

  shoot(): void {
    this.playTone(720, 0.18, 'sawtooth', 0.12, 160);
  }

  correct(): void {
    this.playTone(523.25, 0.12, 'triangle', 0.16);
    window.setTimeout(() => this.playTone(659.25, 0.12, 'triangle', 0.16), 100);
    window.setTimeout(() => this.playTone(783.99, 0.25, 'triangle', 0.18), 200);
  }

  wrong(): void {
    this.playTone(240, 0.18, 'sawtooth', 0.14, 150);
    window.setTimeout(() => this.playTone(170, 0.28, 'sawtooth', 0.14, 110), 150);
  }

  fanfare(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((nota, indice) => {
      window.setTimeout(() => this.playTone(nota, 0.22, 'triangle', 0.18), indice * 130);
    });
  }
}
