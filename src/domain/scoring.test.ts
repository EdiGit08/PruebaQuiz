import { describe, expect, it } from 'vitest';
import { calcularResultado } from './scoring';

describe('calcularResultado', () => {
  it('otorga 100 puntos por cada acierto', () => {
    const resultado = calcularResultado(0, true);

    expect(resultado.puntosGanados).toBe(100);
    expect(resultado.puntaje).toBe(100);
  });

  it('mantiene el puntaje acumulado en aciertos consecutivos', () => {
    const resultado = calcularResultado(100, true);

    expect(resultado.puntosGanados).toBe(100);
    expect(resultado.puntaje).toBe(200);
  });

  it('no suma puntos al fallar', () => {
    const resultado = calcularResultado(250, false);

    expect(resultado.puntosGanados).toBe(0);
    expect(resultado.puntaje).toBe(250);
  });
});
