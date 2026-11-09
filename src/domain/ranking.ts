import type { Jugador } from './types';

export function ordenarRanking(jugadores: readonly Jugador[]): Jugador[] {
  return [...jugadores].sort((a, b) => {
    const porPuntaje = b.puntaje - a.puntaje;
    if (porPuntaje !== 0) return porPuntaje;
    const porRacha = b.rachaMax - a.rachaMax;
    if (porRacha !== 0) return porRacha;
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
}

export function obtenerTop(jugadores: readonly Jugador[], cantidad: number): Jugador[] {
  return ordenarRanking(jugadores).slice(0, Math.max(0, cantidad));
}
