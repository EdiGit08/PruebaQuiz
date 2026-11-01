/**
 * =========================================================================
 * MiniGame3_SpaceDoors (Juego 3: Nave Espacial - Movimiento Libre 4 Direcciones)
 * El usuario se mueve arriba, abajo, izquierda y derecha sin bloquearse.
 * La respuesta final se toma de donde esté ubicado cuando se acaba el tiempo.
 * =========================================================================
 */
export class MiniGame3_SpaceDoors {
  constructor(canvas, onSelectCallback, soundFX) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelectCallback;
    this.sound = soundFX;

    this.running = false;
    this.revealed = false;
    this.selectedOption = 0;
    this.keys = { left: false, right: false, up: false, down: false };
    this.colors = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];
  }

  start(questionObj) {
    this.question = questionObj;
    this.correctIdx = questionObj.correctIndex;
    this.running = true;
    this.revealed = false;

    this.resize();

    this.ship = {
      x: this.width / 2,
      y: this.height - 65
    };

    // Estrellas del fondo
    this.stars = Array.from({ length: 65 }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size: Math.random() * 2.2 + 0.8,
      speed: Math.random() * 3 + 1.5
    }));

    this.gateY = 95;
    this.selectedOption = Math.min(3, Math.max(0, Math.floor(this.ship.x / (this.width / 4))));
    this.onSelect(this.selectedOption, true);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = this.canvas.width = rect.width || 800;
    this.height = this.canvas.height = rect.height || 400;
  }

  setInput(dir, isDown) {
    if (dir === 'left') this.keys.left = isDown;
    if (dir === 'right') this.keys.right = isDown;
    if (dir === 'up') this.keys.up = isDown;
    if (dir === 'down') this.keys.down = isDown;
  }

  updateAlignedGate() {
    const gateW = this.width / 4;
    const idx = Math.min(3, Math.max(0, Math.floor(this.ship.x / gateW)));
    if (this.selectedOption !== idx && !this.revealed) {
      this.selectedOption = idx;
      this.onSelect(idx, true);
    }
  }

  reveal(correctIdx) {
    this.revealed = true;
    this.correctIdx = correctIdx;
  }

  update() {
    if (!this.running) return;

    // Mover fondo estrellado
    this.stars.forEach((s) => {
      s.y += s.speed;
      if (s.y > this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      }
    });

    // Movimiento libre en 4 direcciones (Arriba, Abajo, Izquierda, Derecha)
    if (!this.revealed) {
      const speed = 6.0;
      if (this.keys.left) this.ship.x -= speed;
      if (this.keys.right) this.ship.x += speed;
      if (this.keys.up) this.ship.y -= speed;
      if (this.keys.down) this.ship.y += speed;

      this.ship.x = Math.max(30, Math.min(this.width - 30, this.ship.x));
      this.ship.y = Math.max(70, Math.min(this.height - 35, this.ship.y));
      this.updateAlignedGate();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Espacio profundo
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, this.width, this.height);

    // Estrellas
    ctx.fillStyle = '#e2e8f0';
    this.stars.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    const gateW = this.width / 4;

    // Zona iluminada del sector donde se encuentra la nave actualmente
    const beamGrad = ctx.createLinearGradient(0, 42, 0, this.height);
    beamGrad.addColorStop(0, `${this.colors[this.selectedOption]}44`);
    beamGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(this.selectedOption * gateW + 6, 42, gateW - 12, this.height - 42);

    // Dibujar las 4 puertas Galaga en la zona superior
    if (this.question) {
      this.question.options.forEach((optText, idx) => {
        const x = idx * gateW;
        const isAligned = this.selectedOption === idx;
        const isCorrect = this.revealed && idx === this.correctIdx;
        const isWrongRevealed = this.revealed && idx !== this.correctIdx;

        ctx.save();
        if (isWrongRevealed) ctx.globalAlpha = 0.28;

        // Marco del portal luminoso
        ctx.fillStyle = isCorrect ? '#065f46' : 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        ctx.roundRect(x + 8, 42, gateW - 16, 78, 12);
        ctx.fill();

        ctx.lineWidth = isAligned || isCorrect ? 3.5 : 1.5;
        ctx.strokeStyle = isCorrect ? '#34d399' : this.colors[idx];
        ctx.stroke();

        // Barrera láser inferior del portal
        ctx.strokeStyle = isCorrect ? '#4ade80' : this.colors[idx];
        ctx.lineWidth = isAligned ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(x + 14, 122);
        ctx.lineTo(x + gateW - 14, 122);
        ctx.stroke();

        // Etiqueta del portal
        ctx.fillStyle = this.colors[idx];
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `PUERTA ${idx + 1} ${isAligned ? '⚡ ACTIVA' : ''}`,
          x + gateW / 2,
          62
        );

        // Respuesta en la puerta
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter, sans-serif';
        this.drawSimpleWrap(ctx, optText, x + gateW / 2, 84, gateW - 26, 15);
        ctx.restore();
      });
    }

    // Dibujar Nave Espacial Retro estilo Galaga
    this.drawGalagaShip(ctx, this.ship.x, this.ship.y);
  }

  drawGalagaShip(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Propulsor de fuego
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-8, 20);
    ctx.lineTo(0, 32 + Math.random() * 8);
    ctx.lineTo(8, 20);
    ctx.closePath();
    ctx.fill();

    // Alas exteriores
    ctx.fillStyle = '#e21b3c';
    ctx.beginPath();
    ctx.moveTo(-24, 18);
    ctx.lineTo(-10, -4);
    ctx.lineTo(10, -4);
    ctx.lineTo(24, 18);
    ctx.closePath();
    ctx.fill();

    // Casco principal blanco/azul
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-14, 18);
    ctx.lineTo(14, 18);
    ctx.closePath();
    ctx.fill();

    // Cabina
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawSimpleWrap(ctx, text, x, y, maxW, lineH) {
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
