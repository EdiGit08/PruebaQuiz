import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '../../domain';
import { traducirError } from './errores';

describe('traducirError', () => {
  it('traduce los códigos lanzados por las RPC', () => {
    const error = traducirError({ message: 'NOMBRE_DUPLICADO', code: 'P0001' });

    expect(error).toBeInstanceOf(ErrorDominio);
    expect(error.codigo).toBe('NOMBRE_DUPLICADO');
    expect(error.message).toContain('nombre');
  });

  it('traduce las violaciones de unicidad', () => {
    const error = traducirError({
      message: 'duplicate key value violates unique constraint',
      code: '23505'
    });

    expect(error.codigo).toBe('23505');
    expect(error.message).toContain('nombre');
  });

  it('traduce los fallos de red', () => {
    const error = traducirError({ message: 'Failed to fetch' });

    expect(error.codigo).toBe('ERROR_RED');
  });

  it('oculta los mensajes internos desconocidos', () => {
    const error = traducirError(new Error('detalle interno de la base'));

    expect(error.codigo).toBe('ERROR_DESCONOCIDO');
    expect(error.message).not.toContain('detalle interno');
  });

  it('conserva los errores de dominio', () => {
    const original = new ErrorDominio('PROPIO', 'Mensaje propio.');

    expect(traducirError(original)).toBe(original);
  });
});
