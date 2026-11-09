import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventosSala, PuertoTiempoReal } from '../../application/ports';
import type { Database } from './database.types';
import { traducirError } from './errores';
import { mapearSala } from './mappers';

type SalaRow = Database['public']['Tables']['salas']['Row'];

export class SupabaseRealtime implements PuertoTiempoReal {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  suscribirSala(salaId: string, eventos: EventosSala): () => void {
    const canal = this.supabase
      .channel(`sala:${salaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salas', filter: `id=eq.${salaId}` },
        (payload) => this.actualizarSala(payload.new as SalaRow, eventos)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jugadores', filter: `sala=eq.${salaId}` },
        () => eventos.alCambiarJugadores()
      )
      .subscribe((estado) => {
        eventos.alCambiarConexion(estado === 'SUBSCRIBED');
      });

    return () => {
      void this.supabase.removeChannel(canal);
    };
  }

  private actualizarSala(fila: SalaRow, eventos: EventosSala): void {
    try {
      eventos.alCambiarSala(mapearSala(fila));
    } catch (error) {
      eventos.alError?.(traducirError(error));
    }
  }
}
