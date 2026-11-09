import { MAX_NOMBRE, MIN_NOMBRE } from './constants';

export type ResultadoNombre =
  | { ok: true; nombre: string }
  | { ok: false; error: string };

export function normalizarNombre(valor: string): string {
  return limpiarCaracteres(valor.normalize('NFC'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOMBRE);
}

function limpiarCaracteres(valor: string): string {
  return Array.from(valor)
    .filter((caracter) => {
      const codigo = caracter.charCodeAt(0);
      return codigo > 31 && codigo !== 127 && caracter !== '<' && caracter !== '>';
    })
    .join('');
}

export function validarNombre(valor: string): ResultadoNombre {
  const nombre = normalizarNombre(valor);
  if (nombre.length < MIN_NOMBRE) {
    return { ok: false, error: `El nombre debe tener al menos ${MIN_NOMBRE} caracteres.` };
  }
  if (nombre.length > MAX_NOMBRE) {
    return { ok: false, error: `El nombre debe tener como máximo ${MAX_NOMBRE} caracteres.` };
  }
  return { ok: true, nombre };
}
