import { MiniGame2_Platformer } from '../../../js/minigames/MiniGame2_Platformer.js';
import { MiniGame3_SpaceDoors } from '../../../js/minigames/MiniGame3_SpaceDoors.js';
import { MiniGame4_Conveyor } from '../../../js/minigames/MiniGame4_Conveyor.js';
import { MiniGame5_Cannon } from '../../../js/minigames/MiniGame5_Cannon.js';
import type { AlSeleccionar, PreguntaMinijuego, SonidoMinijuego } from './types';

export interface JuegoCanvas {
  running: boolean;
  start(question: PreguntaMinijuego): void;
  stop(): void;
  resize(): void;
  setInput(dir: string, isDown: boolean): void;
  update(): void;
  draw(): void;
  reveal(correctIdx: number): void;
}

export interface JuegoCintas extends JuegoCanvas {
  selectLane(lane: number, playSound?: boolean): void;
  triggerDropWhenTimeZero(callback: () => void): void;
}

export interface JuegoCanon extends JuegoCanvas {
  restoreSelection(): void;
}

export function crearJuego2(
  canvas: HTMLCanvasElement,
  onSelect: AlSeleccionar,
  sound: SonidoMinijuego
): JuegoCanvas {
  return new MiniGame2_Platformer(canvas, onSelect, sound) as unknown as JuegoCanvas;
}

export function crearJuego3(
  canvas: HTMLCanvasElement,
  onSelect: AlSeleccionar,
  sound: SonidoMinijuego
): JuegoCanvas {
  return new MiniGame3_SpaceDoors(canvas, onSelect, sound) as unknown as JuegoCanvas;
}

export function crearJuego4(
  canvas: HTMLCanvasElement,
  onSelect: AlSeleccionar,
  sound: SonidoMinijuego
): JuegoCintas {
  return new MiniGame4_Conveyor(canvas, onSelect, sound) as unknown as JuegoCintas;
}

export function crearJuego5(
  canvas: HTMLCanvasElement,
  onSelect: AlSeleccionar,
  sound: SonidoMinijuego,
  onLockChange: (bloqueado: boolean) => void
): JuegoCanon {
  return new MiniGame5_Cannon(
    canvas,
    onSelect,
    sound,
    onLockChange
  ) as unknown as JuegoCanon;
}
