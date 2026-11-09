import { MULTIPLICADOR_RACHA, PUNTOS_BASE, RACHA_MINIMA } from './constants';
import type { ResultadoPuntaje } from './types';

export function calcularResultado(
  puntajeActual: number,
  rachaActual: number,
  rachaMax: number,
  esCorrecta: boolean
): ResultadoPuntaje {
  if (!esCorrecta) {
    return {
      esCorrecta: false,
      puntosBase: 0,
      enRacha: false,
      puntosGanados: 0,
      racha: 0,
      rachaMax,
      puntaje: puntajeActual
    };
  }

  const racha = rachaActual + 1;
  const enRacha = racha >= RACHA_MINIMA;
  const puntosGanados = enRacha
    ? Math.round(PUNTOS_BASE * MULTIPLICADOR_RACHA)
    : PUNTOS_BASE;

  return {
    esCorrecta: true,
    puntosBase: PUNTOS_BASE,
    enRacha,
    puntosGanados,
    racha,
    rachaMax: Math.max(rachaMax, racha),
    puntaje: puntajeActual + puntosGanados
  };
}
