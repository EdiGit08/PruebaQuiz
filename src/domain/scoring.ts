import { PUNTOS_BASE } from './constants';
import type { ResultadoPuntaje } from './types';

export function calcularResultado(
  puntajeActual: number,
  esCorrecta: boolean
): ResultadoPuntaje {
  if (!esCorrecta) {
    return {
      esCorrecta: false,
      puntosBase: 0,
      puntosGanados: 0,
      puntaje: puntajeActual
    };
  }

  return {
    esCorrecta: true,
    puntosBase: PUNTOS_BASE,
    puntosGanados: PUNTOS_BASE,
    puntaje: puntajeActual + PUNTOS_BASE
  };
}
