import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PuertoAdmin,
  PuertoJuego,
  PuertoRelojServidor,
  PuertoSalas,
  ResultadoRevelado,
  ResultadoUnion
} from '../../application/ports';
import { ErrorDominio } from '../../domain';
import type { Jugador, Pregunta, PreguntaAdmin, PreguntaEditable, Respuesta, Sala } from '../../domain';
import type { Database, Json } from './database.types';
import { traducirError } from './errores';
import {
  mapearJugador,
  mapearPregunta,
  mapearPreguntasAdminJson,
  mapearRespuesta,
  mapearRespuestaJson,
  mapearResultadoReveladoJson,
  mapearResultadoUnionJson,
  mapearSala,
  mapearSalaJson,
  preguntasAJson
} from './mappers';

type SalaRow = Database['public']['Tables']['salas']['Row'];
type JugadorRow = Database['public']['Tables']['jugadores']['Row'];
type PreguntaRow = Database['public']['Tables']['preguntas']['Row'];
type RespuestaRow = Database['public']['Tables']['respuestas']['Row'];

export class SupabaseQuizGateway
  implements PuertoSalas, PuertoJuego, PuertoAdmin, PuertoRelojServidor
{
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async crearSala(duracionSeg: number): Promise<Sala> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('crear_sala', { p_duracion_seg: duracionSeg })
    );
    return mapearSalaJson(this.requerirDatos(data));
  }

  async unirseASala(codigo: string, nombre: string): Promise<ResultadoUnion> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('unirse_a_sala', { p_codigo: codigo, p_nombre: nombre })
    );
    return mapearResultadoUnionJson(this.requerirDatos(data));
  }

  async salirDeSala(salaId: string): Promise<void> {
    await this.rpcSeguro<undefined>(this.supabase.rpc('salir_de_sala', { p_sala: salaId }));
  }

  async obtenerSala(salaId: string): Promise<Sala | null> {
    const consulta = this.supabase.from('salas').select('*').eq('id', salaId).maybeSingle();
    const data = await this.consultaSegura<SalaRow>(consulta);
    return data ? mapearSala(data) : null;
  }

  async listarJugadores(salaId: string): Promise<Jugador[]> {
    const consulta = this.supabase
      .from('jugadores')
      .select('*')
      .eq('sala', salaId)
      .order('nombre', { ascending: true });
    const data = await this.consultaSegura<JugadorRow[]>(consulta);
    return (data ?? []).map(mapearJugador);
  }

  async obtenerPregunta(salaId: string, ronda: number): Promise<Pregunta | null> {
    const consulta = this.supabase
      .from('preguntas')
      .select('*')
      .eq('sala', salaId)
      .eq('posicion', ronda)
      .maybeSingle();
    const data = await this.consultaSegura<PreguntaRow>(consulta);
    return data ? mapearPregunta(data) : null;
  }

  async obtenerMiRespuesta(salaId: string, ronda: number): Promise<Respuesta | null> {
    const consulta = this.supabase
      .from('respuestas')
      .select('*')
      .eq('sala', salaId)
      .eq('ronda', ronda)
      .maybeSingle();
    const data = await this.consultaSegura<RespuestaRow>(consulta);
    return data ? mapearRespuesta(data) : null;
  }

  async enviarRespuesta(salaId: string, ronda: number, opcion: number): Promise<Respuesta> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('enviar_respuesta', {
        p_sala: salaId,
        p_ronda: ronda,
        p_opcion: opcion
      })
    );
    return mapearRespuestaJson(this.requerirDatos(data));
  }

  async anularRespuesta(salaId: string, ronda: number): Promise<void> {
    await this.rpcSeguro<undefined>(
      this.supabase.rpc('anular_respuesta', { p_sala: salaId, p_ronda: ronda })
    );
  }

  async contarRespondidos(salaId: string, ronda: number): Promise<number> {
    const data = await this.rpcSeguro<number>(
      this.supabase.rpc('contar_respondidos', { p_sala: salaId, p_ronda: ronda })
    );
    return this.requerirDatos(data);
  }

  async obtenerCorrectaRevelada(salaId: string): Promise<number | null> {
    return this.rpcSeguro<number>(
      this.supabase.rpc('obtener_correcta_revelada', { p_sala: salaId })
    );
  }

  async ajustarDuracion(salaId: string, duracionSeg: number): Promise<Sala> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('ajustar_duracion', { p_sala: salaId, p_duracion_seg: duracionSeg })
    );
    return mapearSalaJson(this.requerirDatos(data));
  }

  async guardarPreguntas(salaId: string, preguntas: readonly PreguntaEditable[]): Promise<void> {
    await this.rpcSeguro<undefined>(
      this.supabase.rpc('guardar_preguntas', {
        p_sala: salaId,
        p_preguntas: preguntasAJson(preguntas)
      })
    );
  }

  async iniciarRonda(salaId: string): Promise<Sala> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('iniciar_ronda', { p_sala: salaId })
    );
    return mapearSalaJson(this.requerirDatos(data));
  }

  async revelarRonda(salaId: string): Promise<ResultadoRevelado> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('revelar_ronda', { p_sala: salaId })
    );
    return mapearResultadoReveladoJson(this.requerirDatos(data));
  }

  async avanzarRonda(salaId: string): Promise<Sala> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('avanzar_ronda', { p_sala: salaId })
    );
    return mapearSalaJson(this.requerirDatos(data));
  }

  async reiniciarSala(salaId: string): Promise<Sala> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('reiniciar_sala', { p_sala: salaId })
    );
    return mapearSalaJson(this.requerirDatos(data));
  }

  async expulsarJugador(salaId: string, jugadorId: string): Promise<void> {
    await this.rpcSeguro<undefined>(
      this.supabase.rpc('expulsar_jugador', { p_sala: salaId, p_jugador: jugadorId })
    );
  }

  async purgarSala(salaId: string): Promise<void> {
    await this.rpcSeguro<undefined>(this.supabase.rpc('purgar_sala', { p_sala: salaId }));
  }

  async obtenerPreguntasAdmin(salaId: string): Promise<PreguntaAdmin[]> {
    const data = await this.rpcSeguro<Json>(
      this.supabase.rpc('obtener_preguntas_admin', { p_sala: salaId })
    );
    return mapearPreguntasAdminJson(this.requerirDatos(data));
  }

  async horaServidor(): Promise<string> {
    const data = await this.rpcSeguro<string>(this.supabase.rpc('hora_servidor'));
    return this.requerirDatos(data);
  }

  private async rpcSeguro<T>(
    consulta: PromiseLike<{ data: T | null; error: unknown }>
  ): Promise<T | null> {
    const { data, error } = await consulta;
    if (error) throw traducirError(error);
    return data;
  }

  private async consultaSegura<T>(
    consulta: PromiseLike<{ data: T | null; error: unknown }>
  ): Promise<T | null> {
    const { data, error } = await consulta;
    if (error) throw traducirError(error);
    return data;
  }

  private requerirDatos<T>(data: T | null): T {
    if (data === null || data === undefined) {
      throw new ErrorDominio('DATOS_INVALIDOS', 'La respuesta del servidor está vacía.');
    }
    return data;
  }
}
