import { ErrorDominio, TIPOS_MINIJUEGO } from '../../domain';
import type {
  EstadoSala,
  Jugador,
  Pregunta,
  PreguntaAdmin,
  PreguntaEditable,
  Respuesta,
  Sala,
  TipoMinijuego
} from '../../domain';
import type { ResultadoRevelado, ResultadoUnion } from '../../application/ports';
import type { Database, Json } from './database.types';

type SalaRow = Database['public']['Tables']['salas']['Row'];
type JugadorRow = Database['public']['Tables']['jugadores']['Row'];
type PreguntaRow = Database['public']['Tables']['preguntas']['Row'];
type RespuestaRow = Database['public']['Tables']['respuestas']['Row'];

const ESTADOS: readonly EstadoSala[] = ['WAITING', 'IN_GAME', 'REVEALED', 'PODIUM'];

export function mapearSala(row: SalaRow): Sala {
  return {
    id: row.id,
    codigo: row.codigo,
    estado: leerEstado(row.estado),
    rondaActual: row.ronda_actual,
    duracionSeg: row.duracion_seg,
    inicioRonda: row.inicio_ronda,
    finRonda: row.fin_ronda,
    numeroSesion: row.numero_sesion
  };
}

export function mapearJugador(row: JugadorRow): Jugador {
  return {
    id: row.id,
    salaId: row.sala,
    nombre: row.nombre,
    puntaje: row.puntaje,
    racha: row.racha,
    rachaMax: row.racha_max
  };
}

export function mapearPregunta(row: PreguntaRow): Pregunta {
  return {
    salaId: row.sala,
    posicion: row.posicion,
    tipoMinijuego: leerTipo(row.tipo_minijuego),
    titulo: row.titulo,
    texto: row.texto,
    opciones: leerOpciones(row.opciones)
  };
}

export function mapearRespuesta(row: RespuestaRow): Respuesta {
  return {
    salaId: row.sala,
    jugadorId: row.jugador,
    ronda: row.ronda,
    opcion: row.opcion,
    recibidaEn: row.recibida_en
  };
}

export function mapearSalaJson(valor: Json): Sala {
  const obj = comoObjeto(valor);
  return {
    id: leerTexto(obj, 'id'),
    codigo: leerTexto(obj, 'codigo'),
    estado: leerEstado(leerTexto(obj, 'estado')),
    rondaActual: leerEntero(obj, 'ronda_actual'),
    duracionSeg: leerEntero(obj, 'duracion_seg'),
    inicioRonda: leerTextoONull(obj, 'inicio_ronda'),
    finRonda: leerTextoONull(obj, 'fin_ronda'),
    numeroSesion: leerEntero(obj, 'numero_sesion')
  };
}

export function mapearJugadorJson(valor: Json): Jugador {
  const obj = comoObjeto(valor);
  return {
    id: leerTexto(obj, 'id'),
    salaId: leerTexto(obj, 'sala'),
    nombre: leerTexto(obj, 'nombre'),
    puntaje: leerEntero(obj, 'puntaje'),
    racha: leerEntero(obj, 'racha'),
    rachaMax: leerEntero(obj, 'racha_max')
  };
}

export function mapearRespuestaJson(valor: Json): Respuesta {
  const obj = comoObjeto(valor);
  return {
    salaId: leerTexto(obj, 'sala'),
    jugadorId: leerTexto(obj, 'jugador'),
    ronda: leerEntero(obj, 'ronda'),
    opcion: leerEntero(obj, 'opcion'),
    recibidaEn: leerTexto(obj, 'recibida_en')
  };
}

export function mapearPreguntaAdminJson(valor: Json): PreguntaAdmin {
  const obj = comoObjeto(valor);
  return {
    salaId: leerTexto(obj, 'sala'),
    posicion: leerEntero(obj, 'posicion'),
    tipoMinijuego: leerTipo(leerTexto(obj, 'tipo_minijuego')),
    titulo: leerTexto(obj, 'titulo'),
    texto: leerTexto(obj, 'texto'),
    opciones: leerOpciones(leerRequerido(obj, 'opciones')),
    indiceCorrecto: leerEntero(obj, 'indice_correcto')
  };
}

export function mapearPreguntasAdminJson(valor: Json): PreguntaAdmin[] {
  return comoArreglo(valor).map(mapearPreguntaAdminJson);
}

export function mapearResultadoUnionJson(valor: Json): ResultadoUnion {
  const obj = comoObjeto(valor);
  return {
    sala: mapearSalaJson(leerRequerido(obj, 'sala')),
    jugador: mapearJugadorJson(leerRequerido(obj, 'jugador'))
  };
}

export function mapearResultadoReveladoJson(valor: Json): ResultadoRevelado {
  const obj = comoObjeto(valor);
  return {
    sala: mapearSalaJson(leerRequerido(obj, 'sala')),
    indiceCorrecto: leerEntero(obj, 'indice_correcto')
  };
}

export function preguntasAJson(preguntas: readonly PreguntaEditable[]): Json {
  return preguntas.map((pregunta) => ({
    posicion: pregunta.posicion,
    tipo_minijuego: pregunta.tipoMinijuego,
    titulo: pregunta.titulo,
    texto: pregunta.texto,
    opciones: pregunta.opciones,
    indice_correcto: pregunta.indiceCorrecto
  }));
}

export type ObjetoJson = { [clave: string]: Json | undefined };

export function comoObjeto(valor: Json): ObjetoJson {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'La respuesta del servidor no es válida.');
  }
  return valor;
}

export function comoArreglo(valor: Json): Json[] {
  if (!Array.isArray(valor)) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'La respuesta del servidor no es válida.');
  }
  return valor;
}

export function leerRequerido(obj: ObjetoJson, clave: string): Json {
  const valor = obj[clave];
  if (valor === undefined) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'La respuesta del servidor está incompleta.');
  }
  return valor;
}

function leerTexto(obj: ObjetoJson, clave: string): string {
  const valor = leerRequerido(obj, clave);
  if (typeof valor !== 'string') {
    throw new ErrorDominio('DATOS_INVALIDOS', 'La respuesta del servidor no es válida.');
  }
  return valor;
}

function leerTextoONull(obj: ObjetoJson, clave: string): string | null {
  const valor = leerRequerido(obj, clave);
  if (valor === null) return null;
  if (typeof valor !== 'string') {
    throw new ErrorDominio('DATOS_INVALIDOS', 'La respuesta del servidor no es válida.');
  }
  return valor;
}

function leerEntero(obj: ObjetoJson, clave: string): number {
  const valor = leerRequerido(obj, clave);
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'La respuesta del servidor no es válida.');
  }
  return valor;
}

function leerOpciones(valor: Json): string[] {
  if (!Array.isArray(valor) || valor.length !== 4) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'Las opciones de la pregunta no son válidas.');
  }
  const opciones = valor.filter((item): item is string => typeof item === 'string');
  if (opciones.length !== 4) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'Las opciones de la pregunta no son válidas.');
  }
  return opciones;
}

function leerEstado(valor: string): EstadoSala {
  if (!(ESTADOS as readonly string[]).includes(valor)) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'El estado de la sala no es válido.');
  }
  return valor as EstadoSala;
}

function leerTipo(valor: string): TipoMinijuego {
  if (!(TIPOS_MINIJUEGO as readonly string[]).includes(valor)) {
    throw new ErrorDominio('DATOS_INVALIDOS', 'El tipo de minijuego no es válido.');
  }
  return valor as TipoMinijuego;
}
