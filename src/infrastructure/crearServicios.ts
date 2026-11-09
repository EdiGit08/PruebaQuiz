import {
  ServicioAdmin,
  ServicioJuego,
  ServicioSala,
  ServicioSesion
} from '../application';
import type { PuertoTiempoReal, Reloj } from '../application';
import { crearClienteSupabase } from './supabase/client';
import { SupabaseAuthService } from './supabase/SupabaseAuthService';
import { SupabaseQuizGateway } from './supabase/SupabaseQuizGateway';
import { SupabaseRealtime } from './supabase/SupabaseRealtime';
import { RelojServidor } from './system/RelojServidor';

export interface ServiciosApp {
  sesion: ServicioSesion;
  sala: ServicioSala;
  juego: ServicioJuego;
  admin: ServicioAdmin;
  tiempoReal: PuertoTiempoReal;
  reloj: Reloj;
}

export function crearServicios(): ServiciosApp {
  const supabase = crearClienteSupabase();
  const gateway = new SupabaseQuizGateway(supabase);
  const reloj = new RelojServidor(gateway);

  return {
    sesion: new ServicioSesion(new SupabaseAuthService(supabase)),
    sala: new ServicioSala(gateway),
    juego: new ServicioJuego(gateway, reloj),
    admin: new ServicioAdmin(gateway),
    tiempoReal: new SupabaseRealtime(supabase),
    reloj
  };
}
