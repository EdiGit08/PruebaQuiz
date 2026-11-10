import { ErrorDominio, normalizarCodigoSala, validarPreguntas } from '../domain';
import type { PreguntaAdmin, PreguntaEditable, Sala } from '../domain';
import type { PuertoAdmin, ResultadoRevelado } from './ports';
import { validarDuracion } from './validaciones';

export class ServicioAdmin {
  constructor(private readonly admin: PuertoAdmin) {}

  async ajustarDuracion(salaId: string, duracionSeg: number): Promise<Sala> {
    validarDuracion(duracionSeg);
    return this.admin.ajustarDuracion(salaId, duracionSeg);
  }

  async guardarPreguntas(
    salaId: string,
    preguntas: readonly PreguntaEditable[]
  ): Promise<void> {
    validarPreguntas(preguntas);
    return this.admin.guardarPreguntas(salaId, preguntas);
  }

  async iniciar(salaId: string): Promise<Sala> {
    return this.admin.iniciarRonda(salaId);
  }

  async revelar(salaId: string): Promise<ResultadoRevelado> {
    return this.admin.revelarRonda(salaId);
  }

  async avanzar(salaId: string): Promise<Sala> {
    return this.admin.avanzarRonda(salaId);
  }

  async reiniciar(salaId: string): Promise<Sala> {
    return this.admin.reiniciarSala(salaId);
  }

  async expulsar(salaId: string, jugadorId: string): Promise<void> {
    return this.admin.expulsarJugador(salaId, jugadorId);
  }

  async purgar(salaId: string): Promise<void> {
    return this.admin.purgarSala(salaId);
  }

  async obtenerPreguntas(salaId: string): Promise<PreguntaAdmin[]> {
    return this.admin.obtenerPreguntasAdmin(salaId);
  }

  async buscarPorCodigo(codigo: string): Promise<Sala | null> {
    const normalizado = normalizarCodigoSala(codigo);
    if (!normalizado) {
      throw new ErrorDominio('CODIGO_INVALIDO', 'El código debe tener 6 caracteres.');
    }
    return this.admin.buscarSalaAdmin(normalizado);
  }
}
