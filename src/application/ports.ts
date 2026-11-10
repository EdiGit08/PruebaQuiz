import type {
  Jugador,
  Pregunta,
  PreguntaAdmin,
  PreguntaEditable,
  Respuesta,
  Sala
} from '../domain';
import type { ErrorDominio } from '../domain';

export interface Sesion {
  usuarioId: string;
  email: string | null;
  esAnonimo: boolean;
}

export type EscuchaSesion = (sesion: Sesion | null) => void;

export interface PuertoSesion {
  obtenerSesion(): Promise<Sesion | null>;
  iniciarAnonima(): Promise<Sesion>;
  iniciarConPassword(email: string, password: string): Promise<Sesion>;
  registrarConPassword(email: string, password: string): Promise<Sesion>;
  cerrarSesion(): Promise<void>;
  escuchar(callback: EscuchaSesion): () => void;
}

export interface ResultadoUnion {
  sala: Sala;
  jugador: Jugador;
}

export interface ResultadoRevelado {
  sala: Sala;
  indiceCorrecto: number;
}

export interface PuertoSalas {
  crearSala(duracionSeg: number): Promise<Sala>;
  unirseASala(codigo: string, nombre: string): Promise<ResultadoUnion>;
  salirDeSala(salaId: string): Promise<void>;
  obtenerSala(salaId: string): Promise<Sala | null>;
  listarJugadores(salaId: string): Promise<Jugador[]>;
  obtenerPregunta(salaId: string, ronda: number): Promise<Pregunta | null>;
  obtenerMiRespuesta(salaId: string, ronda: number): Promise<Respuesta | null>;
}

export interface PuertoJuego {
  enviarRespuesta(salaId: string, ronda: number, opcion: number): Promise<Respuesta>;
  anularRespuesta(salaId: string, ronda: number): Promise<void>;
  contarRespondidos(salaId: string, ronda: number): Promise<number>;
  obtenerCorrectaRevelada(salaId: string): Promise<number | null>;
}

export interface PuertoAdmin {
  ajustarDuracion(salaId: string, duracionSeg: number): Promise<Sala>;
  guardarPreguntas(salaId: string, preguntas: readonly PreguntaEditable[]): Promise<void>;
  iniciarRonda(salaId: string): Promise<Sala>;
  revelarRonda(salaId: string): Promise<ResultadoRevelado>;
  avanzarRonda(salaId: string): Promise<Sala>;
  reiniciarSala(salaId: string): Promise<Sala>;
  expulsarJugador(salaId: string, jugadorId: string): Promise<void>;
  purgarSala(salaId: string): Promise<void>;
  obtenerPreguntasAdmin(salaId: string): Promise<PreguntaAdmin[]>;
  buscarSalaAdmin(codigo: string): Promise<Sala | null>;
}

export interface PuertoRelojServidor {
  horaServidor(): Promise<string>;
}

export interface Reloj {
  ahora(): Date;
  sincronizar(): Promise<void>;
}

export interface EventosSala {
  alCambiarSala: (sala: Sala) => void;
  alCambiarJugadores: () => void;
  alCambiarConexion: (conectado: boolean) => void;
  alError?: (error: ErrorDominio) => void;
}

export interface PuertoTiempoReal {
  suscribirSala(salaId: string, eventos: EventosSala): () => void;
}
