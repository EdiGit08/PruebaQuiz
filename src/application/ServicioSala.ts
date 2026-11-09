import { ErrorDominio, normalizarCodigoSala, validarNombre } from '../domain';
import type { Jugador, Pregunta, Respuesta, Sala } from '../domain';
import type { PuertoSalas, ResultadoUnion } from './ports';
import { validarDuracion } from './validaciones';

export class ServicioSala {
  constructor(private readonly salas: PuertoSalas) {}

  async crear(duracionSeg: number): Promise<Sala> {
    validarDuracion(duracionSeg);
    return this.salas.crearSala(duracionSeg);
  }

  async unirse(codigo: string, nombre: string): Promise<ResultadoUnion> {
    const codigoNormalizado = normalizarCodigoSala(codigo);
    if (!codigoNormalizado) {
      throw new ErrorDominio('CODIGO_INVALIDO', 'El código debe tener 6 caracteres.');
    }
    const nombreValidado = validarNombre(nombre);
    if (!nombreValidado.ok) {
      throw new ErrorDominio('NOMBRE_INVALIDO', nombreValidado.error);
    }
    return this.salas.unirseASala(codigoNormalizado, nombreValidado.nombre);
  }

  async salir(salaId: string): Promise<void> {
    return this.salas.salirDeSala(salaId);
  }

  async obtener(salaId: string): Promise<Sala | null> {
    return this.salas.obtenerSala(salaId);
  }

  async listarJugadores(salaId: string): Promise<Jugador[]> {
    return this.salas.listarJugadores(salaId);
  }

  async obtenerPregunta(salaId: string, ronda: number): Promise<Pregunta | null> {
    return this.salas.obtenerPregunta(salaId, ronda);
  }

  async obtenerMiRespuesta(salaId: string, ronda: number): Promise<Respuesta | null> {
    return this.salas.obtenerMiRespuesta(salaId, ronda);
  }
}
