import type { Respuesta } from '../domain';
import type { PuertoJuego, Reloj } from './ports';
import { validarOpcion, validarRonda } from './validaciones';

export class ServicioJuego {
  constructor(
    private readonly juego: PuertoJuego,
    private readonly reloj: Reloj
  ) {}

  async responder(salaId: string, ronda: number, opcion: number): Promise<Respuesta> {
    validarRonda(ronda);
    validarOpcion(opcion);
    return this.juego.enviarRespuesta(salaId, ronda, opcion);
  }

  async anular(salaId: string, ronda: number): Promise<void> {
    validarRonda(ronda);
    return this.juego.anularRespuesta(salaId, ronda);
  }

  async contar(salaId: string, ronda: number): Promise<number> {
    validarRonda(ronda);
    return this.juego.contarRespondidos(salaId, ronda);
  }

  async correcta(salaId: string): Promise<number | null> {
    return this.juego.obtenerCorrectaRevelada(salaId);
  }

  async sincronizarReloj(): Promise<void> {
    return this.reloj.sincronizar();
  }

  ahora(): Date {
    return this.reloj.ahora();
  }

  segundosRestantes(finRonda: string | null): number {
    if (!finRonda) return 0;
    const fin = Date.parse(finRonda);
    if (!Number.isFinite(fin)) return 0;
    return Math.max(0, Math.ceil((fin - this.reloj.ahora().getTime()) / 1000));
  }
}
