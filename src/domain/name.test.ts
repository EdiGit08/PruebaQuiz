import { describe, expect, it } from 'vitest';
import { normalizarNombre, validarNombre } from './name';

describe('normalizarNombre', () => {
  it('recorta espacios y colapsa espacios internos', () => {
    expect(normalizarNombre('  Ana   María  ')).toBe('Ana María');
  });

  it('elimina caracteres de control y ángulos', () => {
    expect(normalizarNombre('A<na>\u0000')).toBe('Ana');
  });

  it('limita el nombre a 30 caracteres', () => {
    expect(normalizarNombre('a'.repeat(40))).toHaveLength(30);
  });
});

describe('validarNombre', () => {
  it('acepta nombres de 2 a 30 caracteres', () => {
    expect(validarNombre('  Ana  ')).toEqual({ ok: true, nombre: 'Ana' });
  });

  it('rechaza nombres demasiado cortos', () => {
    expect(validarNombre(' A ')).toEqual({
      ok: false,
      error: 'El nombre debe tener al menos 2 caracteres.'
    });
  });
});
