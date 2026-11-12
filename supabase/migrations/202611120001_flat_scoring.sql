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
           case when e.acierto then 100 else 0 end as puntos
    from evaluacion e
  )
  update public.jugadores j
  set puntaje = j.puntaje + n.puntos,
      racha = 0,
      racha_max = 0
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

update public.jugadores
set racha = 0,
    racha_max = 0;
