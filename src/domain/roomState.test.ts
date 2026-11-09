import { describe, expect, it } from 'vitest';
import { transicionarSala } from './roomState';

describe('transicionarSala', () => {
  it('inicia la primera ronda desde WAITING', () => {
    const resultado = transicionarSala(
      { estado: 'WAITING', rondaActual: 0, numeroSesion: 1 },
      'INICIAR'
    );

    expect(resultado).toEqual({ estado: 'IN_GAME', rondaActual: 0, numeroSesion: 1 });
  });

  it('revela la ronda actual', () => {
    const resultado = transicionarSala(
      { estado: 'IN_GAME', rondaActual: 2, numeroSesion: 1 },
      'REVELAR'
    );

    expect(resultado.estado).toBe('REVEALED');
    expect(resultado.rondaActual).toBe(2);
  });

  it('avanza a la siguiente ronda', () => {
    const resultado = transicionarSala(
      { estado: 'REVEALED', rondaActual: 2, numeroSesion: 1 },
      'AVANZAR'
    );

    expect(resultado).toEqual({ estado: 'IN_GAME', rondaActual: 3, numeroSesion: 1 });
  });

  it('termina en PODIUM tras la última ronda', () => {
    const resultado = transicionarSala(
      { estado: 'REVEALED', rondaActual: 4, numeroSesion: 1 },
      'AVANZAR'
    );

    expect(resultado).toEqual({ estado: 'PODIUM', rondaActual: 5, numeroSesion: 1 });
  });

  it('reinicia la sala e incrementa la sesión', () => {
    const resultado = transicionarSala(
      { estado: 'PODIUM', rondaActual: 5, numeroSesion: 3 },
      'REINICIAR'
    );

    expect(resultado).toEqual({ estado: 'WAITING', rondaActual: 0, numeroSesion: 4 });
  });

  it('rechaza revelar fuera de IN_GAME', () => {
    expect(() =>
      transicionarSala({ estado: 'WAITING', rondaActual: 0, numeroSesion: 1 }, 'REVELAR')
    ).toThrow('Solo se puede revelar desde IN_GAME.');
  });

  it('rechaza avanzar fuera de REVEALED', () => {
    expect(() =>
      transicionarSala({ estado: 'IN_GAME', rondaActual: 0, numeroSesion: 1 }, 'AVANZAR')
    ).toThrow('Solo se puede avanzar desde REVEALED.');
  });
});
