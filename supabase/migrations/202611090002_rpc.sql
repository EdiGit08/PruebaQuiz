create or replace function public.normalizar_nombre(p_nombre text)
returns text
language sql
immutable
as $$
  select left(
    btrim(
      regexp_replace(
        regexp_replace(coalesce(p_nombre, ''), '[[:cntrl:]<>]', '', 'g'),
        '\s+',
        ' ',
        'g'
      )
    ),
    30
  );
$$;

create or replace function public.es_anonimo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function public.generar_codigo_sala()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_intento integer := 0;
begin
  loop
    v_codigo := '';
    for i in 1..6 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.salas where codigo = v_codigo);
    v_intento := v_intento + 1;
    if v_intento >= 100 then
      raise exception 'NO_SE_PUDO_GENERAR_CODIGO' using errcode = 'P0001';
    end if;
  end loop;
  return v_codigo;
end;
$$;

create or replace function public.insertar_preguntas_por_defecto(p_sala uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.preguntas (sala, posicion, tipo_minijuego, titulo, texto, opciones) values
    (
      p_sala,
      0,
      'kahoot',
      'Juego 1: Kahoot Clásico (Grid 2x2)',
      '¿Qué estructura de datos utiliza el principio LIFO (Last In, First Out)?',
      '["Cola (Queue)", "Pila (Stack)", "Árbol Binario", "Lista Enlazada"]'::jsonb
    ),
    (
      p_sala,
      1,
      'plataformas',
      'Juego 2: Plataformas 2D (Stickman Jumper)',
      '¿Cuál etiqueta de HTML5 se utiliza para dibujar gráficos y físicas 2D mediante JavaScript?',
      '["<canvas>", "<svg-physics>", "<frame2d>", "<webgl>"]'::jsonb
    ),
    (
      p_sala,
      2,
      'nave',
      'Juego 3: Nave Espacial (Vertical Galaga Doors)',
      'En JavaScript ES6, ¿qué palabra clave define una constante cuya referencia no puede reasignarse?',
      '["var", "static", "const", "let"]'::jsonb
    ),
    (
      p_sala,
      3,
      'cintas',
      'Juego 4: Cintas Transportadoras (Conveyor Lanes)',
      '¿Qué protocolo permite comunicación bidireccional en tiempo real entre clientes y servidores web?',
      '["WebSocket", "HTTP Estático", "FTP Simple", "SMTP Mail"]'::jsonb
    ),
    (
      p_sala,
      4,
      'canon',
      'Juego 5: El Cañón / Tiro al Blanco (Target Cannon)',
      '¿Cuál propiedad de CSS Flexbox alinea los elementos a lo largo del eje principal?',
      '["align-items", "display-grid", "z-index", "justify-content"]'::jsonb
    );

  insert into public.respuestas_correctas (sala, posicion, indice_correcto) values
    (p_sala, 0, 1),
    (p_sala, 1, 0),
    (p_sala, 2, 2),
    (p_sala, 3, 0),
    (p_sala, 4, 3);
end;
$$;

create or replace function public.obtener_sala_admin_bloqueada(p_sala uuid)
returns public.salas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
begin
  select * into v_sala from public.salas where id = p_sala for update;
  if not found then
    raise exception 'SALA_NO_EXISTE' using errcode = 'P0001';
  end if;
  if v_sala.admin_id <> auth.uid() then
    raise exception 'NO_AUTORIZADO' using errcode = 'P0001';
  end if;
  return v_sala;
end;
$$;

create or replace function public.validar_preguntas(p_preguntas jsonb)
returns void
language plpgsql
as $$
declare
  v_item jsonb;
  v_total integer;
begin
  if p_preguntas is null
    or jsonb_typeof(p_preguntas) <> 'array'
    or jsonb_array_length(p_preguntas) <> 5 then
    raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
  end if;

  for v_item in select valor from jsonb_array_elements(p_preguntas) as item(valor) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
    end if;
    if (v_item ->> 'posicion') !~ '^[0-4]$'
      or (v_item ->> 'indice_correcto') !~ '^[0-3]$' then
      raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
    end if;
    if coalesce(v_item ->> 'tipo_minijuego', '') not in ('kahoot', 'plataformas', 'nave', 'cintas', 'canon') then
      raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(v_item ->> 'titulo', ''))) not between 1 and 120
      or char_length(btrim(coalesce(v_item ->> 'texto', ''))) not between 1 and 500 then
      raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
    end if;
    if jsonb_typeof(v_item -> 'opciones') <> 'array'
      or jsonb_array_length(v_item -> 'opciones') <> 4 then
      raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_item -> 'opciones') as opcion(valor)
      where jsonb_typeof(opcion.valor) <> 'string'
        or char_length(btrim(opcion.valor #>> '{}')) not between 1 and 120
    ) then
      raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
    end if;
  end loop;

  select count(distinct (item.valor ->> 'posicion')::integer)
  into v_total
  from jsonb_array_elements(p_preguntas) as item(valor);

  if v_total <> 5 then
    raise exception 'PREGUNTAS_INVALIDAS' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.crear_sala(p_duracion_seg integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
begin
  if auth.uid() is null or public.es_anonimo() then
    raise exception 'ADMIN_REQUERIDO' using errcode = 'P0001';
  end if;
  if p_duracion_seg not in (15, 30, 45, 60) then
    raise exception 'DURACION_INVALIDA' using errcode = 'P0001';
  end if;

  insert into public.salas (codigo, admin_id, duracion_seg)
  values (public.generar_codigo_sala(), auth.uid(), p_duracion_seg)
  returning * into v_sala;

  perform public.insertar_preguntas_por_defecto(v_sala.id);
  return to_jsonb(v_sala);
end;
$$;

create or replace function public.unirse_a_sala(p_codigo text, p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
  v_nombre text;
  v_jugador public.jugadores;
  v_existente public.jugadores;
  v_ya_en_sala boolean := false;
  v_total integer;
begin
  if auth.uid() is null then
    raise exception 'AUTENTICACION_REQUERIDA' using errcode = 'P0001';
  end if;

  v_nombre := public.normalizar_nombre(p_nombre);
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 30 then
    raise exception 'NOMBRE_INVALIDO' using errcode = 'P0001';
  end if;

  select * into v_sala
  from public.salas
  where codigo = upper(btrim(p_codigo))
  for update;

  if not found then
    raise exception 'CODIGO_NO_EXISTE' using errcode = 'P0001';
  end if;
  if v_sala.admin_id = auth.uid() then
    raise exception 'ADMIN_NO_JUEGA' using errcode = 'P0001';
  end if;

  select * into v_existente from public.jugadores where id = auth.uid() for update;
  if found then
    if v_existente.sala = v_sala.id then
      v_ya_en_sala := true;
    else
      delete from public.jugadores where id = auth.uid();
    end if;
  end if;

  if exists (
    select 1 from public.jugadores
    where sala = v_sala.id and lower(nombre) = lower(v_nombre) and id <> auth.uid()
  ) then
    raise exception 'NOMBRE_DUPLICADO' using errcode = 'P0001';
  end if;

  if not v_ya_en_sala then
    select count(*) into v_total from public.jugadores where sala = v_sala.id;
    if v_total >= 50 then
      raise exception 'SALA_LLENA' using errcode = 'P0001';
    end if;
  end if;

  insert into public.jugadores (id, sala, nombre)
  values (auth.uid(), v_sala.id, v_nombre)
  on conflict (id) do update
  set sala = excluded.sala,
      nombre = excluded.nombre,
      puntaje = case when public.jugadores.sala = excluded.sala then public.jugadores.puntaje else 0 end,
      racha = case when public.jugadores.sala = excluded.sala then public.jugadores.racha else 0 end,
      racha_max = case when public.jugadores.sala = excluded.sala then public.jugadores.racha_max else 0 end
  returning * into v_jugador;

  return jsonb_build_object('sala', to_jsonb(v_sala), 'jugador', to_jsonb(v_jugador));
end;
$$;

create or replace function public.salir_de_sala(p_sala uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.jugadores where id = auth.uid() and sala = p_sala;
end;
$$;

create or replace function public.enviar_respuesta(p_sala uuid, p_ronda integer, p_opcion integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
  v_respuesta public.respuestas;
begin
  if p_opcion not between 0 and 3 then
    raise exception 'OPCION_INVALIDA' using errcode = 'P0001';
  end if;

  select * into v_sala from public.salas where id = p_sala for share;
  if not found then
    raise exception 'SALA_NO_EXISTE' using errcode = 'P0001';
  end if;
  if v_sala.estado <> 'IN_GAME' or v_sala.ronda_actual <> p_ronda then
    raise exception 'RONDA_NO_ACTIVA' using errcode = 'P0001';
  end if;
  if v_sala.fin_ronda is null or now() >= v_sala.fin_ronda then
    raise exception 'FUERA_DE_TIEMPO' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.jugadores where id = auth.uid() and sala = p_sala
  ) then
    raise exception 'NO_ES_JUGADOR' using errcode = 'P0001';
  end if;

  insert into public.respuestas (sala, jugador, ronda, opcion, recibida_en)
  values (p_sala, auth.uid(), p_ronda, p_opcion, now())
  on conflict (sala, jugador, ronda) do update
  set opcion = excluded.opcion,
      recibida_en = excluded.recibida_en
  returning * into v_respuesta;

  return to_jsonb(v_respuesta);
end;
$$;

create or replace function public.anular_respuesta(p_sala uuid, p_ronda integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
begin
  select * into v_sala from public.salas where id = p_sala for share;
  if not found then
    raise exception 'SALA_NO_EXISTE' using errcode = 'P0001';
  end if;
  if v_sala.estado <> 'IN_GAME' or v_sala.ronda_actual <> p_ronda then
    raise exception 'RONDA_NO_ACTIVA' using errcode = 'P0001';
  end if;
  if v_sala.fin_ronda is null or now() >= v_sala.fin_ronda then
    raise exception 'FUERA_DE_TIEMPO' using errcode = 'P0001';
  end if;

  delete from public.respuestas
  where sala = p_sala and jugador = auth.uid() and ronda = p_ronda;
end;
$$;

create or replace function public.contar_respondidos(p_sala uuid, p_ronda integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_miembro_sala(p_sala) then
    raise exception 'NO_AUTORIZADO' using errcode = 'P0001';
  end if;
  return (
    select count(*)::integer
    from public.respuestas
    where sala = p_sala and ronda = p_ronda
  );
end;
$$;

create or replace function public.obtener_correcta_revelada(p_sala uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
  v_indice integer;
begin
  if not public.es_miembro_sala(p_sala) then
    raise exception 'NO_AUTORIZADO' using errcode = 'P0001';
  end if;

  select * into v_sala from public.salas where id = p_sala;
  if not found then
    raise exception 'SALA_NO_EXISTE' using errcode = 'P0001';
  end if;
  if v_sala.estado <> 'REVEALED' then
    return null;
  end if;

  select indice_correcto into v_indice
  from public.respuestas_correctas
  where sala = p_sala and posicion = v_sala.ronda_actual;

  return v_indice;
end;
$$;

create or replace function public.obtener_preguntas_admin(p_sala uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_sala(p_sala) then
    raise exception 'NO_AUTORIZADO' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'sala', p.sala,
        'posicion', p.posicion,
        'tipo_minijuego', p.tipo_minijuego,
        'titulo', p.titulo,
        'texto', p.texto,
        'opciones', p.opciones,
        'indice_correcto', rc.indice_correcto
      )
      order by p.posicion
    )
    from public.preguntas p
    join public.respuestas_correctas rc
      on rc.sala = p.sala and rc.posicion = p.posicion
    where p.sala = p_sala
  ), '[]'::jsonb);
end;
$$;

create or replace function public.ajustar_duracion(p_sala uuid, p_duracion_seg integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
begin
  v_sala := public.obtener_sala_admin_bloqueada(p_sala);
  if p_duracion_seg not in (15, 30, 45, 60) then
    raise exception 'DURACION_INVALIDA' using errcode = 'P0001';
  end if;
  if v_sala.estado <> 'WAITING' then
    raise exception 'SOLO_EN_ESPERA' using errcode = 'P0001';
  end if;

  update public.salas
  set duracion_seg = p_duracion_seg
  where id = p_sala
  returning * into v_sala;

  return to_jsonb(v_sala);
end;
$$;

create or replace function public.guardar_preguntas(p_sala uuid, p_preguntas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
begin
  v_sala := public.obtener_sala_admin_bloqueada(p_sala);
  if v_sala.estado <> 'WAITING' then
    raise exception 'SOLO_EN_ESPERA' using errcode = 'P0001';
  end if;
  perform public.validar_preguntas(p_preguntas);

  delete from public.preguntas where sala = p_sala;
  delete from public.respuestas_correctas where sala = p_sala;

  insert into public.preguntas (sala, posicion, tipo_minijuego, titulo, texto, opciones)
  select p_sala, x.posicion, x.tipo_minijuego, btrim(x.titulo), btrim(x.texto), x.opciones
  from jsonb_to_recordset(p_preguntas)
    as x(posicion integer, tipo_minijuego text, titulo text, texto text, opciones jsonb);

  insert into public.respuestas_correctas (sala, posicion, indice_correcto)
  select p_sala, x.posicion, x.indice_correcto
  from jsonb_to_recordset(p_preguntas)
    as x(posicion integer, indice_correcto integer);
end;
$$;

create or replace function public.iniciar_ronda(p_sala uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
  v_total integer;
begin
  v_sala := public.obtener_sala_admin_bloqueada(p_sala);
  if v_sala.estado <> 'WAITING' then
    raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
  end if;

  select count(*) into v_total from public.preguntas where sala = p_sala;
  if v_total <> 5 then
    raise exception 'PREGUNTAS_INCOMPLETAS' using errcode = 'P0001';
  end if;

  update public.salas
  set estado = 'IN_GAME',
      ronda_actual = 0,
      inicio_ronda = now(),
      fin_ronda = now() + make_interval(secs => v_sala.duracion_seg)
  where id = p_sala
  returning * into v_sala;

  return to_jsonb(v_sala);
end;
$$;

create or replace function public.revelar_ronda(p_sala uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
  v_correcta integer;
  v_ronda integer;
begin
  v_sala := public.obtener_sala_admin_bloqueada(p_sala);

  if v_sala.estado = 'REVEALED' then
    select indice_correcto into v_correcta
    from public.respuestas_correctas
    where sala = p_sala and posicion = v_sala.ronda_actual;
    return jsonb_build_object('sala', to_jsonb(v_sala), 'indice_correcto', v_correcta);
  end if;

  if v_sala.estado <> 'IN_GAME' then
    raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
  end if;

  v_ronda := v_sala.ronda_actual;
  select indice_correcto into v_correcta
  from public.respuestas_correctas
  where sala = p_sala and posicion = v_ronda;
  if v_correcta is null then
    raise exception 'PREGUNTA_INCOMPLETA' using errcode = 'P0001';
  end if;

  with evaluacion as (
    select j.id,
           coalesce(r.opcion = v_correcta, false) as acierto
    from public.jugadores j
    left join public.respuestas r
      on r.sala = j.sala and r.jugador = j.id and r.ronda = v_ronda
    where j.sala = p_sala
  ),
  nuevos as (
    select e.id,
           case when e.acierto then j.racha + 1 else 0 end as nueva_racha,
           case
             when e.acierto then
               case when j.racha + 1 >= 2 then round(100 * 1.5)::integer else 100 end
             else 0
           end as puntos
    from evaluacion e
    join public.jugadores j on j.id = e.id
  )
  update public.jugadores j
  set puntaje = j.puntaje + n.puntos,
      racha = n.nueva_racha,
      racha_max = greatest(j.racha_max, n.nueva_racha)
  from nuevos n
  where j.id = n.id;

  update public.salas
  set estado = 'REVEALED',
      fin_ronda = now()
  where id = p_sala
  returning * into v_sala;

  return jsonb_build_object('sala', to_jsonb(v_sala), 'indice_correcto', v_correcta);
end;
$$;

create or replace function public.avanzar_ronda(p_sala uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
begin
  v_sala := public.obtener_sala_admin_bloqueada(p_sala);
  if v_sala.estado <> 'REVEALED' then
    raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
  end if;

  if v_sala.ronda_actual < 4 then
    update public.salas
    set estado = 'IN_GAME',
        ronda_actual = v_sala.ronda_actual + 1,
        inicio_ronda = now(),
        fin_ronda = now() + make_interval(secs => v_sala.duracion_seg)
    where id = p_sala
    returning * into v_sala;
  else
    update public.salas
    set estado = 'PODIUM',
        ronda_actual = 5,
        inicio_ronda = null,
        fin_ronda = null
    where id = p_sala
    returning * into v_sala;
  end if;

  return to_jsonb(v_sala);
end;
$$;

create or replace function public.reiniciar_sala(p_sala uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala public.salas;
begin
  v_sala := public.obtener_sala_admin_bloqueada(p_sala);

  delete from public.respuestas where sala = p_sala;
  update public.jugadores
  set puntaje = 0,
      racha = 0,
      racha_max = 0
  where sala = p_sala;

  update public.salas
  set estado = 'WAITING',
      ronda_actual = 0,
      inicio_ronda = null,
      fin_ronda = null,
      numero_sesion = v_sala.numero_sesion + 1
  where id = p_sala
  returning * into v_sala;

  return to_jsonb(v_sala);
end;
$$;

create or replace function public.expulsar_jugador(p_sala uuid, p_jugador uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.obtener_sala_admin_bloqueada(p_sala);
  delete from public.jugadores where sala = p_sala and id = p_jugador;
end;
$$;

create or replace function public.purgar_sala(p_sala uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.obtener_sala_admin_bloqueada(p_sala);
  delete from public.salas where id = p_sala;
end;
$$;

create or replace function public.hora_servidor()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select now();
$$;

revoke all on function public.normalizar_nombre(text) from public, anon, authenticated;
revoke all on function public.es_anonimo() from public, anon, authenticated;
revoke all on function public.generar_codigo_sala() from public, anon, authenticated;
revoke all on function public.insertar_preguntas_por_defecto(uuid) from public, anon, authenticated;
revoke all on function public.obtener_sala_admin_bloqueada(uuid) from public, anon, authenticated;
revoke all on function public.validar_preguntas(jsonb) from public, anon, authenticated;

revoke all on function public.crear_sala(integer) from public, anon;
revoke all on function public.unirse_a_sala(text, text) from public, anon;
revoke all on function public.salir_de_sala(uuid) from public, anon;
revoke all on function public.enviar_respuesta(uuid, integer, integer) from public, anon;
revoke all on function public.anular_respuesta(uuid, integer) from public, anon;
revoke all on function public.contar_respondidos(uuid, integer) from public, anon;
revoke all on function public.obtener_correcta_revelada(uuid) from public, anon;
revoke all on function public.obtener_preguntas_admin(uuid) from public, anon;
revoke all on function public.ajustar_duracion(uuid, integer) from public, anon;
revoke all on function public.guardar_preguntas(uuid, jsonb) from public, anon;
revoke all on function public.iniciar_ronda(uuid) from public, anon;
revoke all on function public.revelar_ronda(uuid) from public, anon;
revoke all on function public.avanzar_ronda(uuid) from public, anon;
revoke all on function public.reiniciar_sala(uuid) from public, anon;
revoke all on function public.expulsar_jugador(uuid, uuid) from public, anon;
revoke all on function public.purgar_sala(uuid) from public, anon;
revoke all on function public.hora_servidor() from public, anon;

grant execute on function public.crear_sala(integer) to authenticated;
grant execute on function public.unirse_a_sala(text, text) to authenticated;
grant execute on function public.salir_de_sala(uuid) to authenticated;
grant execute on function public.enviar_respuesta(uuid, integer, integer) to authenticated;
grant execute on function public.anular_respuesta(uuid, integer) to authenticated;
grant execute on function public.contar_respondidos(uuid, integer) to authenticated;
grant execute on function public.obtener_correcta_revelada(uuid) to authenticated;
grant execute on function public.obtener_preguntas_admin(uuid) to authenticated;
grant execute on function public.ajustar_duracion(uuid, integer) to authenticated;
grant execute on function public.guardar_preguntas(uuid, jsonb) to authenticated;
grant execute on function public.iniciar_ronda(uuid) to authenticated;
grant execute on function public.revelar_ronda(uuid) to authenticated;
grant execute on function public.avanzar_ronda(uuid) to authenticated;
grant execute on function public.reiniciar_sala(uuid) to authenticated;
grant execute on function public.expulsar_jugador(uuid, uuid) to authenticated;
grant execute on function public.purgar_sala(uuid) to authenticated;
grant execute on function public.hora_servidor() to authenticated;
