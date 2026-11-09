import { TIPOS_MINIJUEGO, TOTAL_PREGUNTAS } from './constants';
import { ErrorDominio } from './errors';
import type { PreguntaEditable } from './types';

export const PREGUNTAS_POR_DEFECTO: readonly PreguntaEditable[] = [
  {
    posicion: 0,
    tipoMinijuego: 'kahoot',
    titulo: 'Juego 1: Kahoot Clásico (Grid 2x2)',
    texto: '¿Qué estructura de datos utiliza el principio LIFO (Last In, First Out)?',
    opciones: ['Cola (Queue)', 'Pila (Stack)', 'Árbol Binario', 'Lista Enlazada'],
    indiceCorrecto: 1
  },
  {
    posicion: 1,
    tipoMinijuego: 'plataformas',
    titulo: 'Juego 2: Plataformas 2D (Stickman Jumper)',
    texto: '¿Cuál etiqueta de HTML5 se utiliza para dibujar gráficos y físicas 2D mediante JavaScript?',
    opciones: ['<canvas>', '<svg-physics>', '<frame2d>', '<webgl>'],
    indiceCorrecto: 0
  },
  {
    posicion: 2,
    tipoMinijuego: 'nave',
    titulo: 'Juego 3: Nave Espacial (Vertical Galaga Doors)',
    texto: 'En JavaScript ES6, ¿qué palabra clave define una constante cuya referencia no puede reasignarse?',
    opciones: ['var', 'static', 'const', 'let'],
    indiceCorrecto: 2
  },
  {
    posicion: 3,
    tipoMinijuego: 'cintas',
    titulo: 'Juego 4: Cintas Transportadoras (Conveyor Lanes)',
    texto: '¿Qué protocolo permite comunicación bidireccional en tiempo real entre clientes y servidores web?',
    opciones: ['WebSocket', 'HTTP Estático', 'FTP Simple', 'SMTP Mail'],
    indiceCorrecto: 0
  },
  {
    posicion: 4,
    tipoMinijuego: 'canon',
    titulo: 'Juego 5: El Cañón / Tiro al Blanco (Target Cannon)',
    texto: '¿Cuál propiedad de CSS Flexbox alinea los elementos a lo largo del eje principal?',
    opciones: ['align-items', 'display-grid', 'z-index', 'justify-content'],
    indiceCorrecto: 3
  }
];

export function crearPreguntasPorDefecto(): PreguntaEditable[] {
  return PREGUNTAS_POR_DEFECTO.map((pregunta) => ({
    ...pregunta,
    opciones: [...pregunta.opciones]
  }));
}

export function validarPreguntas(preguntas: readonly PreguntaEditable[]): void {
  if (preguntas.length !== TOTAL_PREGUNTAS) {
    throw new ErrorDominio('PREGUNTAS_INVALIDAS', `Se requieren ${TOTAL_PREGUNTAS} preguntas.`);
  }

  const posiciones = new Set<number>();
  for (const pregunta of preguntas) {
    validarPregunta(pregunta);
    if (posiciones.has(pregunta.posicion)) {
      throw new ErrorDominio('PREGUNTAS_INVALIDAS', 'Las posiciones deben ser únicas.');
    }
    posiciones.add(pregunta.posicion);
  }

  if (posiciones.size !== TOTAL_PREGUNTAS) {
    throw new ErrorDominio('PREGUNTAS_INVALIDAS', 'Las posiciones deben cubrir las 5 rondas.');
  }
}

function validarPregunta(pregunta: PreguntaEditable): void {
  validarPosicion(pregunta.posicion);
  validarTipo(pregunta.tipoMinijuego);
  validarTexto(pregunta.titulo, 'titulo');
  validarTexto(pregunta.texto, 'texto');
  validarOpciones(pregunta.opciones);
  validarIndice(pregunta.indiceCorrecto);
}

function validarPosicion(posicion: number): void {
  if (!Number.isInteger(posicion) || posicion < 0 || posicion >= TOTAL_PREGUNTAS) {
    throw new ErrorDominio('PREGUNTAS_INVALIDAS', 'Posición de pregunta inválida.');
  }
}

function validarTipo(tipo: PreguntaEditable['tipoMinijuego']): void {
  if (!(TIPOS_MINIJUEGO as readonly string[]).includes(tipo)) {
    throw new ErrorDominio('PREGUNTAS_INVALIDAS', 'Tipo de minijuego inválido.');
  }
}

function validarTexto(valor: string, campo: string): void {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    throw new ErrorDominio('PREGUNTAS_INVALIDAS', `El campo ${campo} es obligatorio.`);
  }
}

function validarOpciones(opciones: readonly string[]): void {
  const invalidas =
    !Array.isArray(opciones) ||
    opciones.length !== 4 ||
    opciones.some((opcion) => typeof opcion !== 'string' || opcion.trim().length === 0);
  if (invalidas) {
    throw new ErrorDominio('PREGUNTAS_INVALIDAS', 'Cada pregunta requiere 4 opciones no vacías.');
  }
}

function validarIndice(indice: number): void {
  if (!Number.isInteger(indice) || indice < 0 || indice > 3) {
    throw new ErrorDominio('PREGUNTAS_INVALIDAS', 'El índice correcto debe estar entre 0 y 3.');
  }
}
