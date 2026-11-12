import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const totalJugadores = Number(process.env.LOAD_PLAYERS ?? 50);
const concurrencia = Number(process.env.LOAD_CONCURRENCY ?? 5);
const emailAdmin = process.env.LOAD_ADMIN_EMAIL;
const passwordAdmin = process.env.LOAD_ADMIN_PASSWORD;
const conservarSala = process.env.LOAD_KEEP_SALA === '1';

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

if (!Number.isInteger(totalJugadores) || totalJugadores < 2 || totalJugadores > 50) {
  console.error('LOAD_PLAYERS debe ser un entero entre 2 y 50.');
  process.exit(1);
}

if (!Number.isInteger(concurrencia) || concurrencia < 1 || concurrencia > totalJugadores) {
  console.error('LOAD_CONCURRENCY debe ser un entero entre 1 y LOAD_PLAYERS.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function exigir(etiqueta, consulta) {
  const { data, error } = await consulta;
  if (error) throw new Error(`${etiqueta}: ${error.message}`);
  return data;
}

async function autenticarAdmin() {
  if (emailAdmin && passwordAdmin) {
    await exigir(
      'login admin',
      admin.auth.signInWithPassword({ email: emailAdmin, password: passwordAdmin })
    );
    return;
  }
  const email = `load-${Date.now()}@test.local`;
  const { data, error } = await admin.auth.signUp({
    email,
    password: 'password123'
  });
  if (error) throw new Error(`registro admin: ${error.message}`);
  if (!data.session) throw new Error('El registro admin requiere confirmación de correo.');
}

async function mapaLimitado(elementos, limite, tarea) {
  const resultados = new Array(elementos.length);
  let siguiente = 0;

  async function trabajador() {
    while (siguiente < elementos.length) {
      const indice = siguiente;
      siguiente += 1;
      resultados[indice] = await tarea(elementos[indice], indice);
    }
  }

  const trabajadores = Array.from({ length: limite }, () => trabajador());
  await Promise.all(trabajadores);
  return resultados;
}

function percentil(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, indice)];
}

async function crearJugadores(codigo) {
  const indices = Array.from({ length: totalJugadores }, (_, indice) => indice);
  const jugadores = await mapaLimitado(indices, concurrencia, async (indice) => {
    const cliente = createClient(url, key, { auth: { persistSession: false } });
    const sesion = await exigir(`auth jugador ${indice + 1}`, cliente.auth.signInAnonymously());
    if (!sesion.session) throw new Error(`Jugador ${indice + 1} sin sesión anónima.`);
    const nombre = `Jugador ${String(indice + 1).padStart(2, '0')}`;
    const union = await exigir(
      `unirse ${nombre}`,
      cliente.rpc('unirse_a_sala', { p_codigo: codigo, p_nombre: nombre })
    );
    return { indice, nombre, cliente };
  });
  return jugadores.sort((a, b) => a.indice - b.indice);
}

async function main() {
  await autenticarAdmin();
  const sala = await exigir('crear_sala', admin.rpc('crear_sala', { p_duracion_seg: 30 }));
  console.log(`SALA ${sala.codigo} (${sala.id})`);

  const inicioJugadores = performance.now();
  const jugadores = await crearJugadores(sala.codigo);
  const msJugadores = Math.round(performance.now() - inicioJugadores);
  console.log(`JUGADORES ${jugadores.length}/${totalJugadores} en ${msJugadores} ms`);

  await exigir('iniciar_ronda', admin.rpc('iniciar_ronda', { p_sala: sala.id }));
  const latencias = [];

  for (let ronda = 0; ronda < 5; ronda += 1) {
    const inicioRonda = performance.now();
    await Promise.all(
      jugadores.map((jugador) =>
        exigir(
          `respuesta ${jugador.nombre} ronda ${ronda + 1}`,
          jugador.cliente.rpc('enviar_respuesta', {
            p_sala: sala.id,
            p_ronda: ronda,
            p_opcion: jugador.indice % 4
          })
        )
      )
    );
    latencias.push(performance.now() - inicioRonda);

    const respondidos = await exigir(
      'contar_respondidos',
      admin.rpc('contar_respondidos', { p_sala: sala.id, p_ronda: ronda })
    );
    if (respondidos !== totalJugadores) {
      throw new Error(`Ronda ${ronda + 1}: ${respondidos}/${totalJugadores} respuestas.`);
    }

    const revelado = await exigir('revelar_ronda', admin.rpc('revelar_ronda', { p_sala: sala.id }));
    if (revelado.indice_correcto === null || revelado.indice_correcto === undefined) {
      throw new Error(`Ronda ${ronda + 1} sin respuesta correcta.`);
    }

    const avanzada = await exigir('avanzar_ronda', admin.rpc('avanzar_ronda', { p_sala: sala.id }));
    const estadoEsperado = ronda < 4 ? 'IN_GAME' : 'PODIUM';
    if (avanzada.estado !== estadoEsperado) {
      throw new Error(`Ronda ${ronda + 1}: estado ${avanzada.estado}, esperado ${estadoEsperado}.`);
    }
    console.log(`RONDA ${ronda + 1} OK ${Math.round(latencias[latencias.length - 1])} ms`);
  }

  const ranking = await exigir(
    'ranking',
    admin
      .from('jugadores')
      .select('nombre,puntaje')
      .eq('sala', sala.id)
      .order('puntaje', { ascending: false })
  );
  if (ranking.length !== totalJugadores) {
    throw new Error(`Ranking con ${ranking.length} jugadores, esperados ${totalJugadores}.`);
  }

  const reiniciada = await exigir(
    'reiniciar_sala',
    admin.rpc('reiniciar_sala', { p_sala: sala.id })
  );
  if (reiniciada.estado !== 'WAITING') {
    throw new Error(`Reinicio en estado ${reiniciada.estado}.`);
  }

  const reseteados = await exigir(
    'puntajes reseteados',
    admin.from('jugadores').select('puntaje').eq('sala', sala.id)
  );
  if (reseteados.some((jugador) => jugador.puntaje !== 0)) {
    throw new Error('El reinicio no reseteó todos los puntajes.');
  }

  console.log(
    `LATENCIA p50 ${Math.round(percentil(latencias, 50))} ms, p95 ${Math.round(
      percentil(latencias, 95)
    )} ms, max ${Math.round(Math.max(...latencias))} ms`
  );
  console.log(`TOP ${ranking.slice(0, 3).map((j) => `${j.nombre}:${j.puntaje}`).join(' | ')}`);

  if (!conservarSala) {
    await exigir('purgar_sala', admin.rpc('purgar_sala', { p_sala: sala.id }));
    console.log('SALA_LIMPIA');
  } else {
    console.log(`SALA_CONSERVADA ${sala.codigo}`);
  }

  console.log(`LOAD_TEST_OK ${jugadores.length} jugadores, 5 rondas`);
}

main().catch((error) => {
  console.error(`LOAD_TEST_ERROR ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
