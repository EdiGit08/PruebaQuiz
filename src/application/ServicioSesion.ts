import type { EscuchaSesion, PuertoSesion, Sesion } from './ports';
import { validarCredenciales } from './validaciones';

export class ServicioSesion {
  constructor(private readonly sesion: PuertoSesion) {}

  async restaurar(): Promise<Sesion | null> {
    return this.sesion.obtenerSesion();
  }

  async entrarAnonima(): Promise<Sesion> {
    const actual = await this.sesion.obtenerSesion();
    if (actual?.esAnonimo) return actual;
    if (actual) await this.sesion.cerrarSesion();
    return this.sesion.iniciarAnonima();
  }

  async entrarAdmin(email: string, password: string): Promise<Sesion> {
    validarCredenciales(email, password);
    const actual = await this.sesion.obtenerSesion();
    if (actual?.esAnonimo) await this.sesion.cerrarSesion();
    return this.sesion.iniciarConPassword(email.trim(), password);
  }

  async registrarAdmin(email: string, password: string): Promise<Sesion> {
    validarCredenciales(email, password);
    const actual = await this.sesion.obtenerSesion();
    if (actual) await this.sesion.cerrarSesion();
    return this.sesion.registrarConPassword(email.trim(), password);
  }

  async salir(): Promise<void> {
    return this.sesion.cerrarSesion();
  }

  escuchar(callback: EscuchaSesion): () => void {
    return this.sesion.escuchar(callback);
  }
}
