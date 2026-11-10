import type { AlSeleccionar, PreguntaMinijuego, SonidoMinijuego } from './types';

interface EstiloTarjeta {
  clase: string;
  icono: string;
  etiqueta: string;
}

const ESTILOS: readonly EstiloTarjeta[] = [
  { clase: 'card-red', icono: '▲', etiqueta: 'Opción 1' },
  { clase: 'card-blue', icono: '◆', etiqueta: 'Opción 2' },
  { clase: 'card-yellow', icono: '●', etiqueta: 'Opción 3' },
  { clase: 'card-green', icono: '■', etiqueta: 'Opción 4' }
];

export class MiniGame1Kahoot {
  private selectedOption: number | null = null;
  private locked = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly onSelect: AlSeleccionar,
    private readonly sound: SonidoMinijuego
  ) {}

  start(question: PreguntaMinijuego): void {
    this.selectedOption = null;
    this.locked = false;
    this.container.replaceChildren();
    question.options.forEach((texto, indice) => {
      this.container.appendChild(this.crearTarjeta(texto, indice));
    });
  }

  private crearTarjeta(texto: string, indice: number): HTMLButtonElement {
    const estilo = ESTILOS[indice];
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.dataset.index = String(indice);
    boton.className = `kahoot-card btn-3d ${estilo?.clase ?? ''} rounded-3xl p-5 sm:p-7 flex items-center gap-4 text-left text-white relative overflow-hidden transition-all duration-200 border-2 border-white/20`;

    const icono = document.createElement('div');
    icono.className =
      'w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-black/25 flex items-center justify-center font-arcade text-2xl sm:text-4xl shrink-0 shadow-inner';
    icono.textContent = estilo?.icono ?? '';

    const cuerpo = document.createElement('div');
    cuerpo.className = 'flex-1';
    const etiqueta = document.createElement('span');
    etiqueta.className =
      'text-[11px] uppercase tracking-wider opacity-80 font-bold block mb-0.5';
    etiqueta.textContent = estilo?.etiqueta ?? '';
    const contenido = document.createElement('span');
    contenido.className = 'font-arcade text-lg sm:text-2xl leading-snug block';
    contenido.textContent = texto;
    cuerpo.append(etiqueta, contenido);

    const insignia = document.createElement('div');
    insignia.className =
      'status-badge hidden px-3 py-1 rounded-full bg-white text-slate-950 font-arcade text-xs sm:text-sm shadow';
    insignia.textContent = 'SELECCIONADA';

    boton.append(icono, cuerpo, insignia);
    boton.addEventListener('click', () => this.seleccionar(indice));
    return boton;
  }

  private seleccionar(indice: number): void {
    if (this.locked) return;
    this.selectedOption = indice;
    this.sound.select();
    this.highlightSelection(indice);
    this.onSelect(indice, true);
  }

  private highlightSelection(seleccionado: number): void {
    const tarjetas = this.container.querySelectorAll<HTMLButtonElement>('.kahoot-card');
    tarjetas.forEach((tarjeta, indice) => {
      const insignia = tarjeta.querySelector<HTMLElement>('.status-badge');
      tarjeta.classList.remove(
        'ring-4',
        'ring-white',
        'scale-[1.02]',
        'opacity-45',
        'scale-[0.98]'
      );
      if (indice === seleccionado) {
        tarjeta.classList.add('ring-4', 'ring-white', 'scale-[1.02]');
        if (insignia) {
          insignia.textContent = 'SELECCIONADA';
          insignia.classList.remove('hidden');
        }
      } else {
        tarjeta.classList.add('opacity-45', 'scale-[0.98]');
        insignia?.classList.add('hidden');
      }
    });
  }

  reveal(correctIdx: number): void {
    this.locked = true;
    const tarjetas = this.container.querySelectorAll<HTMLButtonElement>('.kahoot-card');
    tarjetas.forEach((tarjeta, indice) => {
      tarjeta.classList.remove('opacity-45', 'scale-[0.98]', 'scale-[1.02]');
      const insignia = tarjeta.querySelector<HTMLElement>('.status-badge');
      if (indice === correctIdx) {
        tarjeta.classList.add('ring-4', 'ring-emerald-300', 'brightness-110');
        if (insignia) {
          insignia.classList.remove('hidden');
          insignia.textContent = '✓ CORRECTA';
          insignia.className =
            'status-badge px-3 py-1 rounded-full bg-emerald-400 text-slate-950 font-arcade text-xs sm:text-sm shadow';
        }
      } else {
        tarjeta.classList.add('opacity-30', 'grayscale-[60%]');
        if (indice === this.selectedOption && insignia) {
          insignia.classList.remove('hidden');
          insignia.textContent = '✗ TU ELECCIÓN';
          insignia.className =
            'status-badge px-3 py-1 rounded-full bg-rose-500 text-white font-arcade text-xs sm:text-sm shadow';
        }
      }
    });
  }

  stop(): void {}
}
