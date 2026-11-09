begin;
create extension if not exists pgtap;
set search_path = public, extensions;
select no_plan();

create schema if not exists tests;
create table if not exists tests.usuarios (clave text primary key, id uuid not null);
create table if not exists tests.ctx (sala uuid, codigo text);
truncate tests.usuarios, tests.ctx;

grant usage on schema tests to authenticated;
grant select on tests.usuarios to authenticated;
grant select on tests.ctx to authenticated;

create or replace function tests.como(p_id uuid, p_anon boolean default false)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anon)::text,
    true
  );
end;
$$;

create or replace function tests.preguntas_validas()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object('posicion', 0, 'tipo_minijuego', 'kahoot', 'titulo', 'Pregunta 0', 'texto', 'Texto 0', 'opciones', jsonb_build_array('A0', 'B0', 'C0', 'D0'), 'indice_correcto', 0),
    jsonb_build_object('posicion', 1, 'tipo_minijuego', 'plataformas', 'titulo', 'Pregunta 1', 'texto', 'Texto 1', 'opciones', jsonb_build_array('A1', 'B1', 'C1', 'D1'), 'indice_correcto', 1),
    jsonb_build_object('posicion', 2, 'tipo_minijuego', 'nave', 'titulo', 'Pregunta 2', 'texto', 'Texto 2', 'opciones', jsonb_build_array('A2', 'B2', 'C2', 'D2'), 'indice_correcto', 2),
    jsonb_build_object('posicion', 3, 'tipo_minijuego', 'cintas', 'titulo', 'Pregunta 3', 'texto', 'Texto 3', 'opciones', jsonb_build_array('A3', 'B3', 'C3', 'D3'), 'indice_correcto', 3),
    jsonb_build_object('posicion', 4, 'tipo_minijuego', 'canon', 'titulo', 'Pregunta 4', 'texto', 'Texto 4', 'opciones', jsonb_build_array('A4', 'B4', 'C4', 'D4'), 'indice_correcto', 0)
  );
$$;

grant execute on function tests.preguntas_validas() to authenticated;

insert into tests.usuarios (clave, id) values
  ('admin', '00000000-0000-0000-0000-000000000001'),
  ('p1', '00000000-0000-0000-0000-000000000002'),
  ('p2', '00000000-0000-0000-0000-000000000003'),
  ('p3', '00000000-0000-0000-0000-000000000004'),
  ('outsider', '00000000-0000-0000-0000-000000000005');

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
select
  id,
  clave || '@test.local',
  crypt('secret', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
from tests.usuarios
on conflict do nothing;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);

insert into tests.ctx (sala, codigo)
select (r ->> 'id')::uuid, r ->> 'codigo'
from (select public.crear_sala(30) as r) x;

select ok(
  has_function_privilege('authenticated', 'public.crear_sala(integer)', 'execute'),
  'authenticated can execute crear_sala'
);
select ok(
  not has_function_privilege('anon', 'public.crear_sala(integer)', 'execute'),
  'anon cannot execute crear_sala'
);
select is(
  (select count(*)::integer from public.preguntas where sala = (select sala from tests.ctx)),
  5,
  'crear_sala seeds five questions'
);
select is(
  (select count(*)::integer from public.respuestas_correctas where sala = (select sala from tests.ctx)),
  5,
  'crear_sala seeds five correct answers'
);
select is(
  jsonb_array_length(public.obtener_preguntas_admin((select sala from tests.ctx))),
  5,
  'admin reads five questions'
);

select tests.como((select id from tests.usuarios where clave = 'admin'), true);
set local role authenticated;
select throws_ok(
  'select public.crear_sala(30)',
  'P0001',
  'ADMIN_REQUERIDO',
  'anonymous cannot create a room'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select lives_ok(
  format('select public.unirse_a_sala(%L, %L)', (select codigo from tests.ctx), 'Ana'),
  'player one joins'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p2'), true);
set local role authenticated;
select throws_ok(
  format('select public.unirse_a_sala(%L, %L)', (select codigo from tests.ctx), 'ana'),
  'P0001',
  'NOMBRE_DUPLICADO',
  'duplicate names are rejected case-insensitively'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p2'), true);
set local role authenticated;
select lives_ok(
  format('select public.unirse_a_sala(%L, %L)', (select codigo from tests.ctx), 'Beto'),
  'player two joins'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select throws_ok(
  format('select public.unirse_a_sala(%L, %L)', (select codigo from tests.ctx), 'Admin'),
  'P0001',
  'ADMIN_NO_JUEGA',
  'admin cannot join as a player'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'outsider'), true);
set local role authenticated;
select is(
  (select count(*)::integer from public.salas where id = (select sala from tests.ctx)),
  0,
  'outsider cannot see the room'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select is(
  (select count(*)::integer from public.preguntas where sala = (select sala from tests.ctx)),
  0,
  'player sees no questions while waiting'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select throws_ok(
  format('select public.iniciar_ronda(%L)', (select sala from tests.ctx)),
  'P0001',
  'NO_AUTORIZADO',
  'player cannot start the round'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select throws_ok(
  'select count(*) from public.respuestas_correctas',
  '42501',
  null::text,
  'correct answers table is denied'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select throws_ok(
  format('select public.ajustar_duracion(%L, 20)', (select sala from tests.ctx)),
  'P0001',
  'DURACION_INVALIDA',
  'invalid duration is rejected'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.ajustar_duracion(%L, 60)', (select sala from tests.ctx)),
  'admin changes the duration'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select throws_ok(
  format('select public.guardar_preguntas(%L, %L::jsonb)', (select sala from tests.ctx), '[]'),
  'P0001',
  'PREGUNTAS_INVALIDAS',
  'invalid question payload is rejected'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format(
    'select public.guardar_preguntas(%L, %L::jsonb)',
    (select sala from tests.ctx),
    tests.preguntas_validas()::text
  ),
  'admin saves five questions'
);
reset role;

select is(
  jsonb_array_length(public.obtener_preguntas_admin((select sala from tests.ctx))),
  5,
  'admin reads the saved questions'
);

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.iniciar_ronda(%L)', (select sala from tests.ctx)),
  'admin starts the round'
);
reset role;

select is(
  (select estado from public.salas where id = (select sala from tests.ctx)),
  'IN_GAME',
  'room is in game'
);
select is(
  (select ronda_actual from public.salas where id = (select sala from tests.ctx)),
  0,
  'round is zero'
);

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select is(
  (
    select array_agg(posicion order by posicion)
    from public.preguntas
    where sala = (select sala from tests.ctx)
  ),
  array[0],
  'player sees only the current question'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select is(
  public.obtener_correcta_revelada((select sala from tests.ctx)),
  null::integer,
  'correct answer is hidden before reveal'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select lives_ok(
  format('select public.enviar_respuesta(%L, 0, 0)', (select sala from tests.ctx)),
  'player one answers correctly'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p2'), true);
set local role authenticated;
select lives_ok(
  format('select public.enviar_respuesta(%L, 0, 1)', (select sala from tests.ctx)),
  'player two answers incorrectly'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select is(
  public.contar_respondidos((select sala from tests.ctx), 0),
  2,
  'two answers are counted'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select throws_ok(
  format('select public.enviar_respuesta(%L, 0, 4)', (select sala from tests.ctx)),
  'P0001',
  'OPCION_INVALIDA',
  'invalid option is rejected'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select throws_ok(
  format('select public.enviar_respuesta(%L, 1, 0)', (select sala from tests.ctx)),
  'P0001',
  'RONDA_NO_ACTIVA',
  'answer for another round is rejected'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select lives_ok(
  format('select public.enviar_respuesta(%L, 0, 1)', (select sala from tests.ctx)),
  'player can change an answer'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select lives_ok(
  format('select public.enviar_respuesta(%L, 0, 0)', (select sala from tests.ctx)),
  'player can change an answer back'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select is(
  public.contar_respondidos((select sala from tests.ctx), 0),
  2,
  'upsert keeps one answer per player'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.revelar_ronda(%L)', (select sala from tests.ctx)),
  'admin reveals the round'
);
reset role;

select is(
  (select estado from public.salas where id = (select sala from tests.ctx)),
  'REVEALED',
  'room is revealed'
);
select is(
  (select puntaje from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  100,
  'correct answer gives 100 points'
);
select is(
  (select racha from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  1,
  'correct answer starts a streak'
);
select is(
  (select puntaje from public.jugadores where id = (select id from tests.usuarios where clave = 'p2')),
  0,
  'wrong answer gives no points'
);
select is(
  (select racha from public.jugadores where id = (select id from tests.usuarios where clave = 'p2')),
  0,
  'wrong answer resets the streak'
);

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select is(
  public.obtener_correcta_revelada((select sala from tests.ctx)),
  0,
  'correct answer is visible after reveal'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.revelar_ronda(%L)', (select sala from tests.ctx)),
  'reveal is idempotent'
);
reset role;

select is(
  (select puntaje from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  100,
  'idempotent reveal does not double score'
);

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.avanzar_ronda(%L)', (select sala from tests.ctx)),
  'admin advances to the next round'
);
reset role;

select is(
  (select estado from public.salas where id = (select sala from tests.ctx)),
  'IN_GAME',
  'room returns to game'
);
select is(
  (select ronda_actual from public.salas where id = (select sala from tests.ctx)),
  1,
  'round advances to one'
);

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select is(
  (
    select array_agg(posicion order by posicion)
    from public.preguntas
    where sala = (select sala from tests.ctx)
  ),
  array[1],
  'player sees only the next question'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select lives_ok(
  format('select public.enviar_respuesta(%L, 1, 1)', (select sala from tests.ctx)),
  'player answers the second round correctly'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.revelar_ronda(%L)', (select sala from tests.ctx)),
  'admin reveals the second round'
);
reset role;

select is(
  (select puntaje from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  250,
  'streak bonus gives 150 points'
);
select is(
  (select racha from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  2,
  'streak reaches two'
);

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.avanzar_ronda(%L)', (select sala from tests.ctx)),
  'admin advances to the third round'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select lives_ok(
  format('select public.enviar_respuesta(%L, 2, 0)', (select sala from tests.ctx)),
  'player answers the third round incorrectly'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.revelar_ronda(%L)', (select sala from tests.ctx)),
  'admin reveals the third round'
);
reset role;

select is(
  (select racha from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  0,
  'wrong answer resets the streak'
);
select is(
  (select racha_max from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  2,
  'maximum streak is preserved'
);
select is(
  (select puntaje from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  250,
  'wrong answer adds no points'
);

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.reiniciar_sala(%L)', (select sala from tests.ctx)),
  'admin restarts the room'
);
reset role;

select is(
  (select estado from public.salas where id = (select sala from tests.ctx)),
  'WAITING',
  'room returns to waiting'
);
select is(
  (select numero_sesion from public.salas where id = (select sala from tests.ctx)),
  2,
  'restart increments the session'
);
select is(
  (select count(*)::integer from public.jugadores where sala = (select sala from tests.ctx)),
  2,
  'restart keeps players'
);
select is(
  (select count(*)::integer from public.respuestas where sala = (select sala from tests.ctx)),
  0,
  'restart clears answers'
);
select is(
  (select puntaje from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  0,
  'restart resets the score'
);
select is(
  (select racha_max from public.jugadores where id = (select id from tests.usuarios where clave = 'p1')),
  0,
  'restart resets the maximum streak'
);

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format(
    'select public.expulsar_jugador(%L, %L)',
    (select sala from tests.ctx),
    (select id from tests.usuarios where clave = 'p2')
  ),
  'admin expels a player'
);
reset role;

select is(
  (select count(*)::integer from public.jugadores where sala = (select sala from tests.ctx)),
  1,
  'expelled player is removed'
);

select tests.como((select id from tests.usuarios where clave = 'p1'), true);
set local role authenticated;
select lives_ok(
  format('select public.salir_de_sala(%L)', (select sala from tests.ctx)),
  'player leaves the room'
);
reset role;

select is(
  (select count(*)::integer from public.jugadores where sala = (select sala from tests.ctx)),
  0,
  'leaving removes the player'
);

select ok(
  public.hora_servidor() between now() - interval '1 second' and now() + interval '1 second',
  'server time is current'
);

select tests.como((select id from tests.usuarios where clave = 'outsider'), true);
set local role authenticated;
select throws_ok(
  format('select public.contar_respondidos(%L, 0)', (select sala from tests.ctx)),
  'P0001',
  'NO_AUTORIZADO',
  'outsider cannot count answers'
);
reset role;

select tests.como((select id from tests.usuarios where clave = 'admin'), false);
set local role authenticated;
select lives_ok(
  format('select public.purgar_sala(%L)', (select sala from tests.ctx)),
  'admin purges the room'
);
reset role;

select is(
  (select count(*)::integer from public.salas where id = (select sala from tests.ctx)),
  0,
  'purged room is removed'
);

select * from finish();
rollback;
