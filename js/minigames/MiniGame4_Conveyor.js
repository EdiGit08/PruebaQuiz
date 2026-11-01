/**
 * =========================================================================
 * MiniGame4_Conveyor (Juego 4: Cintas Transportadoras / Carriles)
 * Las opciones permanecen arriba durante el conteo y solo bajan cuando el
 * tiempo llega a 0.
 * =========================================================================
 */
export class MiniGame4_Conveyor {
  constructor(canvas, onSelectCallback, soundFX) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelectCallback;
    this.sound = soundFX;

    this.running = false;
    this.revealed = false;
    this.isDropping = false;
    this.onDropComplete = null;
    this.selectedLane = 0;
    this.beltOffset = 0;
    this.crateProgress = 0;
    this.colors = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];

    // Permitir clic directo sobre el carril en el canvas
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.running || this.isDropping || this.revealed) return;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const lane = Math.min(3, Math.max(0, Math.floor(clickX / (rect.width / 4))));
      this.selectLane(lane);
    });
  }

  start(questionObj) {
    this.question = questionObj;
    this.correctIdx = questionObj.correctIndex;
    this.running = true;
    this.revealed = false;
    this.isDropping = false;
    this.onDropComplete = null;
    this.crateProgress = 0; // Fijas arriba mientras corre el tiempo
    this.resize();
    this.selectLane(0, false);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = this.canvas.width = rect.width || 800;
    this.height = this.canvas.height = rect.height || 400;
  }

  selectLane(laneIdx, playSound = true) {
    if (this.isDropping || this.revealed) return;
    this.selectedLane = Math.max(0, Math.min(3, laneIdx));
    if (playSound) this.sound.select();
    this.onSelect(this.selectedLane, true);
  }

  setInput(dir, isDown) {
    if (!isDown || !this.running || this.isDropping || this.revealed) return;
    if (dir === 'left') this.selectLane(this.selectedLane - 1);
    if (dir === 'right') this.selectLane(this.selectedLane + 1);
  }

  /**
   * Se invoca cuando el reloj llega a 0: las opciones bajan por las cintas
   */
  triggerDropWhenTimeZero(callback) {
    if (this.isDropping) return;
    this.isDropping = true;
    this.onDropComplete = callback;
  }

  reveal(correctIdx) {
    this.revealed = true;
    this.correctIdx = correctIdx;
  }

  update() {
    if (!this.running) return;

    // La banda transportadora se mueve continuamente mientras la ronda está activa
    if (!this.revealed) {
      this.beltOffset = (this.beltOffset + (this.isDropping ? 5.5 : 3.0)) % 28;
    }

    // Las cajas permanecen estáticas arriba y solo bajan al final cuando el tiempo llega a 0
    if (this.isDropping && !this.revealed) {
      this.crateProgress += 0.016;
      if (this.crateProgress >= 1) {
        this.crateProgress = 1;
        if (this.onDropComplete) {
          const cb = this.onDropComplete;
          this.onDropComplete = null;
          cb();
        }
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, this.width, this.height);

    const laneW = this.width / 4;
    const collectorY = this.height - 62;

    if (this.question) {
      this.question.options.forEach((optText, idx) => {
        const x = idx * laneW;
        const isSelected = this.selectedLane === idx;
        const isCorrect = this.revealed && idx === this.correctIdx;

        // Pista de la cinta transportadora
        ctx.fillStyle = isSelected ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.65)';
        ctx.fillRect(x + 12, 20, laneW - 24, collectorY - 10);

        // Rodillos de la cinta
        ctx.strokeStyle = isSelected ? `${this.colors[idx]}88` : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 3;
        for (let y = 30 + this.beltOffset; y < collectorY; y += 28) {
          ctx.beginPath();
          ctx.moveTo(x + 18, y);
          ctx.lineTo(x + laneW - 18, y);
          ctx.stroke();
        }

        // Bordes de la cinta
        ctx.strokeStyle = isCorrect ? '#4ade80' : isSelected ? '#facc15' : this.colors[idx];
        ctx.lineWidth = isSelected || isCorrect ? 3.5 : 1.5;
        ctx.strokeRect(x + 12, 20, laneW - 24, collectorY - 10);

        // Caja de respuesta (fija arriba hasta que el tiempo llega a 0)
        const crateY = 40 + this.crateProgress * (collectorY - 120);
        ctx.save();
        if (this.revealed && !isCorrect) ctx.globalAlpha = 0.3;

        ctx.fillStyle = this.colors[idx];
        ctx.beginPath();
        ctx.roundRect(x + 20, crateY, laneW - 40, 74, 12);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`CARRIL ${idx + 1} (Tecla ${idx + 1})`, x + laneW / 2, crateY + 18);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter, sans-serif';
        this.drawWrap(ctx, optText, x + laneW / 2, crateY + 40, laneW - 52, 15);
        ctx.restore();
      });
    }

    // Línea de meta inferior
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, collectorY);
    ctx.lineTo(this.width, collectorY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Carrito recolector del jugador en el carril activo
    const cartX = this.selectedLane * laneW + laneW / 2;
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(cartX - laneW * 0.38, collectorY - 8, laneW * 0.76, 46, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛒 COLECTOR ACTIVO', cartX, collectorY + 20);
    ctx.restore();
  }

  drawWrap(ctx, text, x, y, maxW, lineH) {
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
