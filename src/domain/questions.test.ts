import { describe, expect, it } from 'vitest';
import { crearPreguntasPorDefecto, validarPreguntas } from './questions';
import type { PreguntaEditable } from './types';

describe('validarPreguntas', () => {
  it('acepta las 5 preguntas por defecto', () => {
    expect(() => validarPreguntas(crearPreguntasPorDefecto())).not.toThrow();
  });

  it('rechaza una cantidad distinta de 5 preguntas', () => {
    expect(() => validarPreguntas(crearPreguntasPorDefecto().slice(0, 4))).toThrow(
      'Se requieren 5 preguntas.'
    );
  });

  it('rechaza opciones vacías', () => {
    const preguntas = crearPreguntasPorDefecto();
    preguntas[0] = { ...preguntas[0], opciones: ['A', '', 'C', 'D'] } as PreguntaEditable;

    expect(() => validarPreguntas(preguntas)).toThrow('Cada pregunta requiere 4 opciones no vacías.');
  });

  it('rechaza posiciones duplicadas', () => {
    const preguntas = crearPreguntasPorDefecto();
    preguntas[1] = { ...preguntas[1], posicion: 0 } as PreguntaEditable;

    expect(() => validarPreguntas(preguntas)).toThrow('Las posiciones deben ser únicas.');
  });

  it('rechaza índices correctos fuera de rango', () => {
    const preguntas = crearPreguntasPorDefecto();
    preguntas[0] = { ...preguntas[0], indiceCorrecto: 4 } as PreguntaEditable;

    expect(() => validarPreguntas(preguntas)).toThrow(
      'El índice correcto debe estar entre 0 y 3.'
    );
  });
});
