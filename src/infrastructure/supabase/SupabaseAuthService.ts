import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { EscuchaSesion, PuertoSesion, Sesion } from '../../application/ports';
import { ErrorDominio } from '../../domain';
import type { Database } from './database.types';
import { traducirError } from './errores';

export class SupabaseAuthService implements PuertoSesion {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async obtenerSesion(): Promise<Sesion | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw traducirError(error);
    return data.session ? mapearSesion(data.session) : null;
  }

  async iniciarAnonima(): Promise<Sesion> {
    const { data, error } = await this.supabase.auth.signInAnonymously();
    if (error) throw traducirError(error);
    return this.requerirSesion(data.session);
  }

  async iniciarConPassword(email: string, password: string): Promise<Sesion> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw traducirError(error);
    return this.requerirSesion(data.session);
  }

  async registrarConPassword(email: string, password: string): Promise<Sesion> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw traducirError(error);
    if (!data.session) {
      throw new ErrorDominio('CONFIRMACION_REQUERIDA', 'Revisa tu correo para confirmar la cuenta.');
    }
    return mapearSesion(data.session);
  }

  async cerrarSesion(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw traducirError(error);
  }

  escuchar(callback: EscuchaSesion): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_evento, session) => {
      callback(session ? mapearSesion(session) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  private requerirSesion(session: Session | null): Sesion {
    if (!session) {
      throw new ErrorDominio('SESION_INVALIDA', 'No se pudo iniciar la sesión.');
    }
    return mapearSesion(session);
  }
}

function mapearSesion(session: Session): Sesion {
  const { user } = session;
  return {
    usuarioId: user.id,
    email: user.email ?? null,
    esAnonimo: user.is_anonymous ?? user.app_metadata.provider === 'anonymous'
  };
}
