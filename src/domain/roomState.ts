import { TOTAL_PREGUNTAS } from './constants';
import { ErrorDominio } from './errors';
import type { EstadoSala } from './types';

export type AccionSala = 'INICIAR' | 'REVELAR' | 'AVANZAR' | 'REINICIAR';

export interface EstadoSalaSnapshot {
  estado: EstadoSala;
  rondaActual: number;
  numeroSesion: number;
}

export function transicionarSala(
  actual: EstadoSalaSnapshot,
  accion: AccionSala
): EstadoSalaSnapshot {
  if (accion === 'INICIAR') {
    if (actual.estado !== 'WAITING') {
      throw new ErrorDominio('TRANSICION_INVALIDA', 'Solo se puede iniciar desde WAITING.');
    }
    return { ...actual, estado: 'IN_GAME', rondaActual: 0 };
  }

  if (accion === 'REVELAR') {
    if (actual.estado !== 'IN_GAME') {
      throw new ErrorDominio('TRANSICION_INVALIDA', 'Solo se puede revelar desde IN_GAME.');
    }
    return { ...actual, estado: 'REVEALED' };
  }

  if (accion === 'AVANZAR') {
    return avanzar(actual);
  }

  return { ...actual, estado: 'WAITING', rondaActual: 0, numeroSesion: actual.numeroSesion + 1 };
}

function avanzar(actual: EstadoSalaSnapshot): EstadoSalaSnapshot {
  if (actual.estado !== 'REVEALED') {
    throw new ErrorDominio('TRANSICION_INVALIDA', 'Solo se puede avanzar desde REVEALED.');
  }
  if (actual.rondaActual + 1 < TOTAL_PREGUNTAS) {
    return { ...actual, estado: 'IN_GAME', rondaActual: actual.rondaActual + 1 };
  }
  return { ...actual, estado: 'PODIUM', rondaActual: TOTAL_PREGUNTAS };
}
