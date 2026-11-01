/**
 * =========================================================================
 * MiniGame1_Kahoot (Juego 1: Kahoot Clásico Grid 2x2)
 * 4 tarjetas vibrantes (Rojo, Azul, Amarillo, Verde).
 * Permite cambiar de opción libremente mientras el tiempo siga activo.
 * =========================================================================
 */
export class MiniGame1_Kahoot {
  constructor(containerEl, onSelectCallback, soundFX) {
    this.container = containerEl;
    this.onSelect = onSelectCallback;
    this.sound = soundFX;
    this.selectedOption = null;
    this.locked = false;
  }

  start(questionObj) {
    this.selectedOption = null;
    this.locked = false;
    this.container.innerHTML = '';

    const styles = [
      { cls: 'card-red', icon: '▲', label: 'Opción 1' },
      { cls: 'card-blue', icon: '◆', label: 'Opción 2' },
      { cls: 'card-yellow', icon: '●', label: 'Opción 3' },
      { cls: 'card-green', icon: '■', label: 'Opción 4' }
    ];

    questionObj.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.index = idx;
      btn.className = `kahoot-card btn-3d ${styles[idx].cls} rounded-3xl p-5 sm:p-7 flex items-center gap-4 text-left text-white relative overflow-hidden transition-all duration-200 border-2 border-white/20`;

      btn.innerHTML = `
        <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-black/25 flex items-center justify-center font-arcade text-2xl sm:text-4xl shrink-0 shadow-inner">
          ${styles[idx].icon}
        </div>
        <div class="flex-1">
          <span class="text-[11px] uppercase tracking-wider opacity-80 font-bold block mb-0.5">${styles[idx].label}</span>
          <span class="font-arcade text-lg sm:text-2xl leading-snug block">${optText}</span>
        </div>
        <div class="status-badge hidden px-3 py-1 rounded-full bg-white text-slate-950 font-arcade text-xs sm:text-sm shadow">
          SELECCIONADA
        </div>
      `;

      btn.addEventListener('click', () => {
        // Permite cambiar la selección todas las veces que quiera antes de que termine la ronda
        if (this.locked) return;
        this.selectedOption = idx;
        if (this.sound) this.sound.select();
        this.highlightSelection(idx);
        this.onSelect(idx, true);
      });

      this.container.appendChild(btn);
    });
  }

  highlightSelection(selectedIdx) {
    const cards = this.container.querySelectorAll('.kahoot-card');
    cards.forEach((card, idx) => {
      const badge = card.querySelector('.status-badge');
      // Limpiar clases previas para permitir cambiar de opción limpiamente
      card.classList.remove('ring-4', 'ring-white', 'scale-[1.02]', 'opacity-45', 'scale-[0.98]');
      if (idx === selectedIdx) {
        card.classList.add('ring-4', 'ring-white', 'scale-[1.02]');
        if (badge) {
          badge.textContent = 'SELECCIONADA';
          badge.classList.remove('hidden');
        }
      } else {
        card.classList.add('opacity-45', 'scale-[0.98]');
        if (badge) badge.classList.add('hidden');
      }
    });
  }

  reveal(correctIdx) {
    this.locked = true;
    const cards = this.container.querySelectorAll('.kahoot-card');
    cards.forEach((card, idx) => {
      card.classList.remove('opacity-45', 'scale-[0.98]', 'scale-[1.02]');
      const badge = card.querySelector('.status-badge');
      if (idx === correctIdx) {
        card.classList.add('ring-4', 'ring-emerald-300', 'brightness-110');
        if (badge) {
          badge.classList.remove('hidden');
          badge.textContent = '✓ CORRECTA';
          badge.className = 'status-badge px-3 py-1 rounded-full bg-emerald-400 text-slate-950 font-arcade text-xs sm:text-sm shadow';
        }
      } else {
        card.classList.add('opacity-30', 'grayscale-[60%]');
        if (idx === this.selectedOption && badge) {
          badge.classList.remove('hidden');
          badge.textContent = '✗ TU ELECCIÓN';
          badge.className = 'status-badge px-3 py-1 rounded-full bg-rose-500 text-white font-arcade text-xs sm:text-sm shadow';
        }
      }
    });
  }

  stop() {}
}
