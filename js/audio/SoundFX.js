/**
 * =========================================================================
 * SoundFX (Sintetizador de Audio Retro con Web Audio API)
 * Cero dependencias de archivos MP3 externos.
 * =========================================================================
 */
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq = 440, duration = 0.12, type = 'sine', volume = 0.12, slideTo = null) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      }

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Ignorar si el navegador bloquea autoplay antes de interacción
    }
  }

  select() {
    this.playTone(520, 0.09, 'triangle', 0.14, 680);
  }

  jump() {
    this.playTone(260, 0.16, 'sine', 0.14, 580);
  }

  shoot() {
    this.playTone(720, 0.18, 'sawtooth', 0.12, 160);
  }

  correct() {
    this.playTone(523.25, 0.12, 'triangle', 0.16);
    setTimeout(() => this.playTone(659.25, 0.12, 'triangle', 0.16), 100);
    setTimeout(() => this.playTone(783.99, 0.25, 'triangle', 0.18), 200);
  }

  wrong() {
    this.playTone(240, 0.18, 'sawtooth', 0.14, 150);
    setTimeout(() => this.playTone(170, 0.28, 'sawtooth', 0.14, 110), 150);
  }

  fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.22, 'triangle', 0.18), idx * 130);
    });
  }
}
