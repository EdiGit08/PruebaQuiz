import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorDominio } from '../../domain';
import type { Database } from './database.types';

export function crearClienteSupabase(): SupabaseClient<Database> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new ErrorDominio('CONFIGURACION_INVALIDA', 'Faltan las variables de Supabase.');
  }
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });
}
