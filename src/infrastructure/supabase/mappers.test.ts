import { describe, expect, it } from 'vitest';
import { crearPreguntasPorDefecto } from '../../domain';
import type { Database } from './database.types';
import {
  comoArreglo,
  comoObjeto,
  mapearJugador,
  mapearPregunta,
  mapearPreguntasAdminJson,
  mapearResultadoReveladoJson,
  mapearSala,
  mapearSalaJson,
  preguntasAJson
} from './mappers';

type SalaRow = Database['public']['Tables']['salas']['Row'];
type JugadorRow = Database['public']['Tables']['jugadores']['Row'];
type PreguntaRow = Database['public']['Tables']['preguntas']['Row'];

const salaRow: SalaRow = {
  id: 'sala-1',
  codigo: 'ABC123',
  admin_id: 'admin-1',
  estado: 'WAITING',
  ronda_actual: 0,
  duracion_seg: 30,
  inicio_ronda: null,
  fin_ronda: null,
  numero_sesion: 1,
  creada_en: '2026-01-01T00:00:00.000Z'
};

const salaJson = {
  id: 'sala-1',
  codigo: 'ABC123',
  estado: 'WAITING',
  ronda_actual: 0,
  duracion_seg: 30,
  inicio_ronda: null,
  fin_ronda: null,
  numero_sesion: 1
};

describe('mappers de filas', () => {
  it('mapea una sala al dominio', () => {
    expect(mapearSala(salaRow)).toEqual({
      id: 'sala-1',
      codigo: 'ABC123',
      estado: 'WAITING',
      rondaActual: 0,
      duracionSeg: 30,
      inicioRonda: null,
      finRonda: null,
      numeroSesion: 1
    });
  });

  it('mapea un jugador al dominio', () => {
    const row: JugadorRow = {
      id: 'jugador-1',
      sala: 'sala-1',
      nombre: 'Ana',
      puntaje: 150,
      racha: 0,
      racha_max: 0,
      creado_en: '2026-01-01T00:00:00.000Z'
    };

    expect(mapearJugador(row)).toEqual({
      id: 'jugador-1',
      salaId: 'sala-1',
      nombre: 'Ana',
      puntaje: 150
    });
  });

  it('rechaza preguntas sin cuatro opciones', () => {
    const row: PreguntaRow = {
      id: 'pregunta-1',
      sala: 'sala-1',
      posicion: 0,
      tipo_minijuego: 'kahoot',
      titulo: 'Pregunta',
      texto: '¿Texto?',
      opciones: ['A', 'B']
    };

    expect(() => mapearPregunta(row)).toThrow('Las opciones');
  });
});

describe('mappers de JSON de RPC', () => {
  it('mapea la sala devuelta por una RPC', () => {
    expect(mapearSalaJson(salaJson).codigo).toBe('ABC123');
  });

  it('rechaza estados desconocidos', () => {
    expect(() => mapearSalaJson({ ...salaJson, estado: 'BROKEN' })).toThrow('estado');
  });

  it('mapea el resultado de revelar', () => {
    const resultado = mapearResultadoReveladoJson({
      sala: salaJson,
      indice_correcto: 2
    });

    expect(resultado.indiceCorrecto).toBe(2);
    expect(resultado.sala.id).toBe('sala-1');
  });

  it('mapea las preguntas del panel admin', () => {
    const preguntas = mapearPreguntasAdminJson([
      {
        sala: 'sala-1',
        posicion: 0,
        tipo_minijuego: 'kahoot',
        titulo: 'Pregunta',
        texto: '¿Texto?',
        opciones: ['A', 'B', 'C', 'D'],
        indice_correcto: 1
      }
    ]);

    expect(preguntas).toHaveLength(1);
    expect(preguntas[0]?.indiceCorrecto).toBe(1);
  });

  it('serializa las preguntas para guardar', () => {
    const json = preguntasAJson(crearPreguntasPorDefecto());
    if (!Array.isArray(json)) throw new Error('Se esperaba un arreglo.');

    expect(json).toHaveLength(5);
    expect(json[0]).toMatchObject({ posicion: 0, tipo_minijuego: 'kahoot' });
  });
});

describe('validación de JSON', () => {
  it('rechaza valores que no son objetos', () => {
    expect(() => comoObjeto([])).toThrow('no es válida');
  });

  it('rechaza valores que no son arreglos', () => {
    expect(() => comoArreglo({})).toThrow('no es válida');
  });
});
