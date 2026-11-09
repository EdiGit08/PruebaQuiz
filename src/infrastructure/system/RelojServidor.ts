import type { PuertoRelojServidor, Reloj } from '../../application/ports';
import { ErrorDominio } from '../../domain';

export class RelojServidor implements Reloj {
  private desfaseMs = 0;

  constructor(private readonly puerto: PuertoRelojServidor) {}

  ahora(): Date {
    return new Date(Date.now() + this.desfaseMs);
  }

  async sincronizar(): Promise<void> {
    const inicio = Date.now();
    const horaServidor = Date.parse(await this.puerto.horaServidor());
    if (!Number.isFinite(horaServidor)) {
      throw new ErrorDominio('RELOJ_INVALIDO', 'No se pudo sincronizar el reloj.');
    }
    const fin = Date.now();
    this.desfaseMs = horaServidor - Math.round((inicio + fin) / 2);
  }
}
