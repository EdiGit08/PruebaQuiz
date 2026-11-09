import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelojServidor } from './RelojServidor';

describe('RelojServidor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aplica el desfase del servidor', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const reloj = new RelojServidor({
      horaServidor: async () => '2026-01-01T00:00:10.000Z'
    });

    await reloj.sincronizar();

    expect(reloj.ahora().toISOString()).toBe('2026-01-01T00:00:10.000Z');
  });

  it('rechaza una hora de servidor inválida', async () => {
    const reloj = new RelojServidor({
      horaServidor: async () => 'no-es-una-fecha'
    });

    await expect(reloj.sincronizar()).rejects.toMatchObject({ codigo: 'RELOJ_INVALIDO' });
  });
});
