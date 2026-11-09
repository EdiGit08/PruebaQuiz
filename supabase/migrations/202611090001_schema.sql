create extension if not exists pgcrypto;

create table public.salas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{6}$'),
  admin_id uuid not null references auth.users(id) on delete cascade,
  estado text not null default 'WAITING' check (estado in ('WAITING', 'IN_GAME', 'REVEALED', 'PODIUM')),
  ronda_actual integer not null default 0 check (ronda_actual between 0 and 5),
  duracion_seg integer not null default 30 check (duracion_seg in (15, 30, 45, 60)),
  inicio_ronda timestamptz,
  fin_ronda timestamptz,
  numero_sesion integer not null default 1 check (numero_sesion >= 1),
  creada_en timestamptz not null default now()
);

create table public.preguntas (
  id uuid primary key default gen_random_uuid(),
  sala uuid not null references public.salas(id) on delete cascade,
  posicion integer not null check (posicion between 0 and 4),
  tipo_minijuego text not null check (tipo_minijuego in ('kahoot', 'plataformas', 'nave', 'cintas', 'canon')),
  titulo text not null,
  texto text not null,
  opciones jsonb not null check (jsonb_typeof(opciones) = 'array' and jsonb_array_length(opciones) = 4),
  unique (sala, posicion)
);

create table public.respuestas_correctas (
  sala uuid not null references public.salas(id) on delete cascade,
  posicion integer not null check (posicion between 0 and 4),
  indice_correcto integer not null check (indice_correcto between 0 and 3),
  primary key (sala, posicion),
  foreign key (sala, posicion) references public.preguntas(sala, posicion) on delete cascade
);

create table public.jugadores (
  id uuid primary key references auth.users(id) on delete cascade,
  sala uuid not null references public.salas(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 30),
  puntaje integer not null default 0 check (puntaje >= 0),
  racha integer not null default 0 check (racha >= 0),
  racha_max integer not null default 0 check (racha_max >= 0),
  creado_en timestamptz not null default now()
);

create unique index jugadores_sala_nombre_unique on public.jugadores (sala, lower(nombre));
create index jugadores_sala_idx on public.jugadores (sala);

create table public.respuestas (
  sala uuid not null references public.salas(id) on delete cascade,
  jugador uuid not null references public.jugadores(id) on delete cascade,
  ronda integer not null check (ronda between 0 and 4),
  opcion integer not null check (opcion between 0 and 3),
  recibida_en timestamptz not null default now(),
  primary key (sala, jugador, ronda)
);

create index respuestas_sala_ronda_idx on public.respuestas (sala, ronda);

alter table public.salas replica identity full;
alter table public.jugadores replica identity full;

alter table public.salas enable row level security;
alter table public.preguntas enable row level security;
alter table public.respuestas_correctas enable row level security;
alter table public.jugadores enable row level security;
alter table public.respuestas enable row level security;

create or replace function public.es_admin_sala(p_sala uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.salas s
    where s.id = p_sala and s.admin_id = auth.uid()
  );
$$;

create or replace function public.es_jugador_sala(p_sala uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jugadores j
    where j.sala = p_sala and j.id = auth.uid()
  );
$$;

create or replace function public.es_miembro_sala(p_sala uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin_sala(p_sala) or public.es_jugador_sala(p_sala);
$$;

create policy salas_select on public.salas
  for select to authenticated
  using (public.es_miembro_sala(id));

create policy preguntas_select on public.preguntas
  for select to authenticated
  using (
    public.es_miembro_sala(sala)
    and exists (
      select 1
      from public.salas s
      where s.id = preguntas.sala
        and s.estado in ('IN_GAME', 'REVEALED')
        and s.ronda_actual = preguntas.posicion
    )
  );

create policy jugadores_select on public.jugadores
  for select to authenticated
  using (public.es_miembro_sala(sala));

create policy respuestas_select_propias on public.respuestas
  for select to authenticated
  using (jugador = auth.uid());

revoke all on table public.salas from anon;
revoke all on table public.preguntas from anon;
revoke all on table public.respuestas_correctas from anon, authenticated;
revoke all on table public.jugadores from anon;
revoke all on table public.respuestas from anon;

grant select on table public.salas to authenticated;
grant select on table public.preguntas to authenticated;
grant select on table public.jugadores to authenticated;
grant select on table public.respuestas to authenticated;

grant execute on function public.es_admin_sala(uuid) to authenticated;
grant execute on function public.es_jugador_sala(uuid) to authenticated;
grant execute on function public.es_miembro_sala(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salas'
    ) then
      execute 'alter publication supabase_realtime add table public.salas';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jugadores'
    ) then
      execute 'alter publication supabase_realtime add table public.jugadores';
    end if;
  end if;
end $$;
