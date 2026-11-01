/**
 * =========================================================================
 * MiniGame2_Platformer (Juego 2: Plataformas 2D - Stickman Jumper)
 * Plataformas más bajas y salto mejorado para que el muñeco llegue sin problema.
 * =========================================================================
 */
export class MiniGame2_Platformer {
  constructor(canvas, onSelectCallback, soundFX) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelectCallback;
    this.sound = soundFX;

    this.running = false;
    this.revealed = false;
    this.correctIdx = 0;
    this.selectedOption = null;

    this.keys = { left: false, right: false };
    this.colors = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];
  }

  start(questionObj) {
    this.question = questionObj;
    this.correctIdx = questionObj.correctIndex;
    this.revealed = false;
    this.selectedOption = null;
    this.running = true;

    this.resize();

    // Estado del Stickman
    this.player = {
      x: this.width / 2,
      y: this.height - 28,
      vx: 0,
      vy: 0,
      radius: 14,
      height: 44,
      onGround: true,
      walkCycle: 0,
      currentPlatform: null
    };

    this.setupPlatforms();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = this.canvas.width = rect.width || 800;
    this.height = this.canvas.height = rect.height || 400;
    this.setupPlatforms();
  }

  setupPlatforms() {
    if (!this.question) return;
    const padX = this.width * 0.04;
    const usableW = this.width - padX * 2;
    const platW = usableW / 4 - 14;
    const floorY = this.height - 28;
    // Plataformas más bajas (a solo ~85px - 100px del suelo) para que el salto llegue con total facilidad
    const basePlatY = floorY - 88;

    this.platforms = this.question.options.map((text, idx) => ({
      index: idx,
      x: padX + idx * (platW + 18),
      y: basePlatY - (idx % 2 === 0 ? 0 : 14),
      w: platW,
      h: 20,
      text,
      color: this.colors[idx],
      fallVy: 0,
      falling: false
    }));
  }

  setInput(dir, isDown) {
    if (dir === 'left') this.keys.left = isDown;
    if (dir === 'right') this.keys.right = isDown;
    if (dir === 'action' && isDown) this.jump();
  }

  jump() {
    if (!this.running) return;
    if (this.player.onGround) {
      this.player.vy = -14.2; // Salto amplio que supera cómodamente las plataformas
      this.player.onGround = false;
      this.sound.jump();
    }
  }

  reveal(correctIdx) {
    this.revealed = true;
    this.correctIdx = correctIdx;
    // Las 3 plataformas incorrectas caen por gravedad
    this.platforms.forEach((p) => {
      if (p.index !== correctIdx) {
        p.falling = true;
        p.fallVy = 2;
      }
    });
  }

  update() {
    if (!this.running) return;

    const speed = 5.5;
    if (this.keys.left) {
      this.player.vx = -speed;
      this.player.walkCycle += 0.25;
    } else if (this.keys.right) {
      this.player.vx = speed;
      this.player.walkCycle += 0.25;
    } else {
      this.player.vx *= 0.78;
    }

    const prevBottom = this.player.y;
    this.player.x += this.player.vx;
    this.player.vy += 0.48; // Gravedad suave
    this.player.y += this.player.vy;

    // Límites laterales
    this.player.x = Math.max(20, Math.min(this.width - 20, this.player.x));

    this.player.onGround = false;
    let landedPlatform = null;

    // Actualizar plataformas y chequear colisión superior
    this.platforms.forEach((p) => {
      if (p.falling) {
        p.fallVy += 0.45;
        p.y += p.fallVy;
      }

      if (
        !p.falling &&
        this.player.vy >= 0 &&
        this.player.x >= p.x - 8 &&
        this.player.x <= p.x + p.w + 8 &&
        prevBottom <= p.y + 12 &&
        this.player.y >= p.y
      ) {
        this.player.y = p.y;
        this.player.vy = 0;
        this.player.onGround = true;
        landedPlatform = p.index;
      }
    });

    // Si está sobre una plataforma, actualiza su respuesta seleccionada
    if (landedPlatform !== null && !this.revealed) {
      if (this.selectedOption !== landedPlatform) {
        this.selectedOption = landedPlatform;
        this.onSelect(landedPlatform, true);
      }
    }

    // Colisión con el suelo base
    const floorY = this.height - 28;
    if (this.player.y >= floorY) {
      this.player.y = floorY;
      this.player.vy = 0;
      this.player.onGround = true;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Fondo nocturno con cuadrícula sutil
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Suelo / Lava si ya se reveló
    const floorY = this.height - 28;
    ctx.fillStyle = this.revealed ? '#991b1b' : '#1e293b';
    ctx.fillRect(0, floorY, this.width, 28);
    ctx.fillStyle = this.revealed ? '#ef4444' : '#475569';
    ctx.fillRect(0, floorY, this.width, 4);

    // Dibujar las 4 plataformas
    this.platforms.forEach((p, idx) => {
      const isSelected = this.selectedOption === idx;
      const isCorrect = this.revealed && idx === this.correctIdx;

      ctx.save();
      // Sombra o resplandor si está seleccionada
      if (isSelected || isCorrect) {
        ctx.shadowColor = isCorrect ? '#4ade80' : '#facc15';
        ctx.shadowBlur = 18;
      }

      // Cuerpo de la plataforma
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 8);
      ctx.fill();

      ctx.lineWidth = isSelected || isCorrect ? 3 : 1.5;
      ctx.strokeStyle = isCorrect ? '#86efac' : isSelected ? '#fde047' : 'rgba(255,255,255,0.4)';
      ctx.stroke();
      ctx.restore();

      // Cartel flotante encima de la plataforma con el texto de la opción
      const boxH = 54;
      const boxY = p.y - boxH - 14;
      ctx.fillStyle = isSelected ? 'rgba(30, 41, 59, 0.96)' : 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(p.x, boxY, p.w, boxH, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Número de opción
      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`OPCIÓN ${idx + 1}${isSelected ? ' ★ ACTIVA' : ''}`, p.x + p.w / 2, boxY + 17);

      // Texto de la respuesta
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Inter, sans-serif';
      this.drawWrappedText(ctx, p.text, p.x + p.w / 2, boxY + 35, p.w - 12, 14);
    });

    // Dibujar Stickman (Muñeco de palitos animado)
    this.drawStickman(ctx, this.player.x, this.player.y);
  }

  drawStickman(ctx, x, bottomY) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const swing = Math.sin(this.player.walkCycle) * 8;

    // Piernas
    ctx.beginPath();
    ctx.moveTo(x, bottomY - 18);
    ctx.lineTo(x - 7 + swing, bottomY);
    ctx.moveTo(x, bottomY - 18);
    ctx.lineTo(x + 7 - swing, bottomY);
    ctx.stroke();

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, bottomY - 18);
    ctx.lineTo(x, bottomY - 36);
    ctx.stroke();

    // Brazos
    ctx.beginPath();
    ctx.moveTo(x, bottomY - 32);
    ctx.lineTo(x - 11 - swing * 0.5, bottomY - 22);
    ctx.moveTo(x, bottomY - 32);
    ctx.lineTo(x + 11 + swing * 0.5, bottomY - 22);
    ctx.stroke();

    // Cabeza
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x, bottomY - 45, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cinta ninja roja en la cabeza
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 9, bottomY - 47);
    ctx.lineTo(x + 9, bottomY - 47);
    ctx.stroke();

    ctx.restore();
  }

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, y);
  }

  stop() {
    this.running = false;
  }
}
