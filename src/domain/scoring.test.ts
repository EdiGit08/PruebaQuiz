import { describe, expect, it } from 'vitest';
import { calcularResultado } from './scoring';

describe('calcularResultado', () => {
  it('otorga 100 puntos en el primer acierto', () => {
    const resultado = calcularResultado(0, 0, 0, true);

    expect(resultado.puntosGanados).toBe(100);
    expect(resultado.racha).toBe(1);
    expect(resultado.enRacha).toBe(false);
    expect(resultado.puntaje).toBe(100);
  });

  it('aplica x1.5 desde el segundo acierto consecutivo', () => {
    const resultado = calcularResultado(100, 1, 1, true);

    expect(resultado.puntosGanados).toBe(150);
    expect(resultado.racha).toBe(2);
    expect(resultado.enRacha).toBe(true);
    expect(resultado.puntaje).toBe(250);
    expect(resultado.rachaMax).toBe(2);
  });

  it('reinicia la racha al fallar sin restar puntos', () => {
    const resultado = calcularResultado(250, 3, 3, false);

    expect(resultado.puntosGanados).toBe(0);
    expect(resultado.racha).toBe(0);
    expect(resultado.puntaje).toBe(250);
    expect(resultado.rachaMax).toBe(3);
  });

  it('mantiene la racha máxima histórica', () => {
    const resultado = calcularResultado(250, 1, 3, true);

    expect(resultado.rachaMax).toBe(3);
  });
});
