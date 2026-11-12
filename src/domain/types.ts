import type { TIPOS_MINIJUEGO } from './constants';

export type TipoMinijuego = (typeof TIPOS_MINIJUEGO)[number];
export type EstadoSala = 'WAITING' | 'IN_GAME' | 'REVEALED' | 'PODIUM';

export interface Sala {
  id: string;
  codigo: string;
  estado: EstadoSala;
  rondaActual: number;
  duracionSeg: number;
  inicioRonda: string | null;
  finRonda: string | null;
  numeroSesion: number;
}

export interface Jugador {
  id: string;
  salaId: string;
  nombre: string;
  puntaje: number;
}

export interface Pregunta {
  salaId: string;
  posicion: number;
  tipoMinijuego: TipoMinijuego;
  titulo: string;
  texto: string;
  opciones: string[];
}

export interface PreguntaAdmin extends Pregunta {
  indiceCorrecto: number;
}

export interface PreguntaEditable {
  posicion: number;
  tipoMinijuego: TipoMinijuego;
  titulo: string;
  texto: string;
  opciones: string[];
  indiceCorrecto: number;
}

export interface Respuesta {
  salaId: string;
  jugadorId: string;
  ronda: number;
  opcion: number;
  recibidaEn: string;
}

export interface ResultadoPuntaje {
  esCorrecta: boolean;
  puntosBase: number;
  puntosGanados: number;
  puntaje: number;
}
