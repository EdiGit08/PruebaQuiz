import { describe, expect, it } from 'vitest';
import { ordenarRanking } from './ranking';
import type { Jugador } from './types';

const jugador = (id: string, nombre: string, puntaje: number, rachaMax: number): Jugador => ({
  id,
  salaId: 'sala-1',
  nombre,
  puntaje,
  racha: 0,
  rachaMax
});

describe('ordenarRanking', () => {
  it('ordena por puntaje descendente', () => {
    const ranking = ordenarRanking([
      jugador('1', 'Ana', 100, 1),
      jugador('2', 'Luis', 300, 2),
      jugador('3', 'Eva', 200, 3)
    ]);

    expect(ranking.map((j) => j.nombre)).toEqual(['Luis', 'Eva', 'Ana']);
  });

  it('desempata por racha máxima y luego por nombre', () => {
    const ranking = ordenarRanking([
      jugador('1', 'Zoe', 300, 2),
      jugador('2', 'Ana', 300, 3),
      jugador('3', 'Luis', 300, 2)
    ]);

    expect(ranking.map((j) => j.nombre)).toEqual(['Ana', 'Luis', 'Zoe']);
  });
});
