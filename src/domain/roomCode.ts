import { CODIGO_SALA_LONGITUD } from './constants';

const PATRON_CODIGO = new RegExp(`^[A-Z0-9]{${CODIGO_SALA_LONGITUD}}$`);

export function normalizarCodigoSala(valor: string): string | null {
  const codigo = valor.trim().toUpperCase();
  return PATRON_CODIGO.test(codigo) ? codigo : null;
}
