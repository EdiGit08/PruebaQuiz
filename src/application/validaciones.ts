import { DURACIONES_PERMITIDAS, ErrorDominio, TOTAL_PREGUNTAS } from '../domain';

export function validarDuracion(duracionSeg: number): void {
  const permitidas: readonly number[] = DURACIONES_PERMITIDAS;
  if (!permitidas.includes(duracionSeg)) {
    throw new ErrorDominio('DURACION_INVALIDA', 'La duración debe ser 15, 30, 45 o 60 segundos.');
  }
}

export function validarRonda(ronda: number): void {
  if (!Number.isInteger(ronda) || ronda < 0 || ronda >= TOTAL_PREGUNTAS) {
    throw new ErrorDominio('RONDA_INVALIDA', 'La ronda no es válida.');
  }
}

export function validarOpcion(opcion: number): void {
  if (!Number.isInteger(opcion) || opcion < 0 || opcion > 3) {
    throw new ErrorDominio('OPCION_INVALIDA', 'La opción debe estar entre 0 y 3.');
  }
}

export function validarCredenciales(email: string, password: string): void {
  if (!email.includes('@') || email.trim().length < 5) {
    throw new ErrorDominio('CREDENCIALES_INVALIDAS', 'Ingresa un correo válido.');
  }
  if (password.length < 6) {
    throw new ErrorDominio('CREDENCIALES_INVALIDAS', 'La contraseña debe tener al menos 6 caracteres.');
  }
}
