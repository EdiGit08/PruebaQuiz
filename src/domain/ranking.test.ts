import { describe, expect, it } from 'vitest';
import { ordenarRanking } from './ranking';
import type { Jugador } from './types';

const jugador = (id: string, nombre: string, puntaje: number): Jugador => ({
  id,
  salaId: 'sala-1',
  nombre,
  puntaje
});

describe('ordenarRanking', () => {
  it('ordena por puntaje descendente', () => {
    const ranking = ordenarRanking([
      jugador('1', 'Ana', 100),
      jugador('2', 'Luis', 300),
      jugador('3', 'Eva', 200)
    ]);

    expect(ranking.map((j) => j.nombre)).toEqual(['Luis', 'Eva', 'Ana']);
  });

  it('desempata por nombre cuando hay el mismo puntaje', () => {
    const ranking = ordenarRanking([
      jugador('1', 'Zoe', 300),
      jugador('2', 'Ana', 300),
      jugador('3', 'Luis', 300)
    ]);

    expect(ranking.map((j) => j.nombre)).toEqual(['Ana', 'Luis', 'Zoe']);
  });
});
