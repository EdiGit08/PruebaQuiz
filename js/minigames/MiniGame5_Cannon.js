/**
 * =========================================================================
 * MiniGame5_Cannon (Juego 5: El Cañón con opción de Restaurar Selección)
 * =========================================================================
 */
export class MiniGame5_Cannon {
  constructor(canvas, onSelectCallback, soundFX, onLockChangeCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelectCallback;
    this.sound = soundFX;
    this.onLockChange = onLockChangeCallback;

    this.running = false;
    this.revealed = false;
    this.locked = false;
    this.selectedOption = null;
    this.angle = -Math.PI / 2;
    this.keys = { left: false, right: false };
    this.projectiles = [];
    this.particles = [];
    this.timeTick = 0;
    this.colors = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];

    // Apuntar y disparar con mouse/touch en el canvas
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.running || this.locked || this.revealed) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = this.width / 2;
      const cy = this.height - 28;
      const ang = Math.atan2(my - cy, mx - cx);
      if (ang < -0.2 && ang > -Math.PI + 0.2) {
        this.angle = ang;
      }
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.running || this.locked || this.revealed) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = this.width / 2;
      const cy = this.height - 28;
      const ang = Math.atan2(my - cy, mx - cx);
      if (ang < -0.2 && ang > -Math.PI + 0.2) {
        this.angle = ang;
        this.shoot();
      }
    });
  }

  start(questionObj) {
    this.question = questionObj;
    this.correctIdx = questionObj.correctIndex;
    this.running = true;
    this.revealed = false;
    this.locked = false;
    this.selectedOption = null;
    this.angle = -Math.PI / 2;
    this.projectiles = [];
    this.particles = [];
    this.timeTick = 0;

    this.resize();
    this.setupTargets();
    if (this.onLockChange) this.onLockChange(false);
  }

  /**
   * Permite al jugador restaurar su disparo si cambió de opinión antes de que acabe el tiempo
   */
  restoreSelection() {
    if (this.revealed) return;
    this.locked = false;
    this.selectedOption = null;
    this.projectiles = [];
    if (this.targets) {
      this.targets.forEach((t) => (t.hit = false));
    }
    if (this.onLockChange) this.onLockChange(false);
    this.onSelect(null, false);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = this.canvas.width = rect.width || 800;
    this.height = this.canvas.height = rect.height || 400;
    this.setupTargets();
  }

  setupTargets() {
    if (!this.question) return;
    const slotW = this.width / 4;
    this.targets = this.question.options.map((text, idx) => ({
      index: idx,
      baseX: idx * slotW + slotW / 2,
      x: idx * slotW + slotW / 2,
      y: 95 + (idx % 2 === 0 ? 0 : 22),
      r: Math.min(54, slotW * 0.38),
      text,
      color: this.colors[idx],
      hit: false
    }));
  }

  setInput(dir, isDown) {
    if (dir === 'left') this.keys.left = isDown;
    if (dir === 'right') this.keys.right = isDown;
    if (dir === 'action' && isDown) this.shoot();
  }

  shoot() {
    if (!this.running || this.locked || this.revealed) return;
    this.sound.shoot();
    const speed = 13;
    const cx = this.width / 2;
    const cy = this.height - 32;
    this.projectiles.push({
      x: cx + Math.cos(this.angle) * 42,
      y: cy + Math.sin(this.angle) * 42,
      vx: Math.cos(this.angle) * speed,
      vy: Math.sin(this.angle) * speed
    });
  }

  spawnParticles(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 + 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1,
        color
      });
    }
  }

  reveal(correctIdx) {
    this.revealed = true;
    this.correctIdx = correctIdx;
    if (this.onLockChange) this.onLockChange(false);
  }

  update() {
    if (!this.running) return;
    this.timeTick += 0.03;

    // Rotar cañón con teclado
    if (!this.locked && !this.revealed) {
      if (this.keys.left) this.angle -= 0.035;
      if (this.keys.right) this.angle += 0.035;
      this.angle = Math.max(-Math.PI + 0.22, Math.min(-0.22, this.angle));
    }

    // Oscilación horizontal suave de los 4 globos/dianas
    if (this.targets) {
      this.targets.forEach((t, idx) => {
        t.x = t.baseX + Math.sin(this.timeTick + idx * 1.3) * 18;
      });
    }

    // Actualizar proyectiles y colisiones con los globos
    this.projectiles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (!this.locked && this.targets) {
        this.targets.forEach((t) => {
          const dist = Math.hypot(p.x - t.x, p.y - t.y);
          if (dist <= t.r + 8) {
            t.hit = true;
            this.locked = true;
            this.selectedOption = t.index;
            this.spawnParticles(t.x, t.y, t.color);
            this.sound.select();
            if (this.onLockChange) this.onLockChange(true);
            this.onSelect(t.index, true);
          }
        });
      }
    });

    this.projectiles = this.projectiles.filter(
      (p) => p.x > 0 && p.x < this.width && p.y > 0 && p.y < this.height && !this.locked
    );

    // Actualizar partículas
    this.particles.forEach((pt) => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 0.03;
    });
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Cielo arcade
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height - 26;

    // Línea láser de puntería
    if (!this.locked && !this.revealed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(this.angle) * 450, cy + Math.sin(this.angle) * 450);
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar los 4 globos/dianas
    if (this.targets) {
      this.targets.forEach((t, idx) => {
        const isSelected = this.selectedOption === idx;
        const isCorrect = this.revealed && idx === this.correctIdx;

        ctx.save();
        if (this.revealed && !isCorrect) ctx.globalAlpha = 0.28;

        // Cuerda/canasta del globo
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x - 10, t.y + t.r - 4);
        ctx.lineTo(t.x - 6, t.y + t.r + 14);
        ctx.moveTo(t.x + 10, t.y + t.r - 4);
        ctx.lineTo(t.x + 6, t.y + t.r + 14);
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.fillRect(t.x - 10, t.y + t.r + 14, 20, 12);

        // Globo principal
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = isSelected || isCorrect ? 4 : 2;
        ctx.strokeStyle = isCorrect ? '#4ade80' : isSelected ? '#fde047' : '#ffffff';
        ctx.stroke();

        // Texto en el globo
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `DIANA ${idx + 1} ${isSelected ? '🎯' : ''}`,
          t.x,
          t.y - t.r * 0.42
        );

        ctx.font = 'bold 12px Inter, sans-serif';
        this.drawBalloonText(ctx, t.text, t.x, t.y - 4, t.r * 1.75, 14);

        ctx.restore();
      });
    }

    // Proyectiles
    ctx.fillStyle = '#facc15';
    this.projectiles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    // Partículas de impacto
    this.particles.forEach((pt) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Dibujar Cañón en la base central
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.roundRect(0, -11, 48, 22, 6);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Base semiesférica del cañón
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 24, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawBalloonText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line.trim(), x, y);
        line = words[i] + ' ';
        y += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, y);
  }

  stop() {
    this.running = false;
  }
}
