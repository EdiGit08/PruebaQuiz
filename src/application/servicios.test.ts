import { describe, expect, it, vi } from 'vitest';
import { crearPreguntasPorDefecto } from '../domain';
import type { Jugador, Pregunta, Respuesta, Sala } from '../domain';
import { ServicioAdmin } from './ServicioAdmin';
import { ServicioJuego } from './ServicioJuego';
import { ServicioSala } from './ServicioSala';
import { ServicioSesion } from './ServicioSesion';
import type {
  PuertoAdmin,
  PuertoJuego,
  PuertoSalas,
  PuertoSesion,
  Reloj,
  Sesion
} from './ports';

const sala: Sala = {
  id: 'sala-1',
  codigo: 'ABC123',
  estado: 'WAITING',
  rondaActual: 0,
  duracionSeg: 30,
  inicioRonda: null,
  finRonda: null,
  numeroSesion: 1
};

const jugador: Jugador = {
  id: 'jugador-1',
  salaId: 'sala-1',
  nombre: 'Ana',
  puntaje: 0,
  racha: 0,
  rachaMax: 0
};

const pregunta: Pregunta = {
  salaId: 'sala-1',
  posicion: 0,
  tipoMinijuego: 'kahoot',
  titulo: 'Pregunta',
  texto: '¿Texto?',
  opciones: ['A', 'B', 'C', 'D']
};

const respuesta: Respuesta = {
  salaId: 'sala-1',
  jugadorId: 'jugador-1',
  ronda: 0,
  opcion: 1,
  recibidaEn: '2026-01-01T00:00:00.000Z'
};

const sesionAnonima: Sesion = { usuarioId: 'u1', email: null, esAnonimo: true };
const sesionAdmin: Sesion = { usuarioId: 'a1', email: 'admin@test.local', esAnonimo: false };

function crearPuertoSalas() {
  return {
    crearSala: vi.fn(async () => sala),
    unirseASala: vi.fn(async () => ({ sala, jugador })),
    salirDeSala: vi.fn(async () => undefined),
    obtenerSala: vi.fn(async () => sala),
    listarJugadores: vi.fn(async () => [jugador]),
    obtenerPregunta: vi.fn(async () => pregunta),
    obtenerMiRespuesta: vi.fn(async () => respuesta)
  } satisfies PuertoSalas;
}

function crearPuertoJuego() {
  return {
    enviarRespuesta: vi.fn(async () => respuesta),
    anularRespuesta: vi.fn(async () => undefined),
    contarRespondidos: vi.fn(async () => 1),
    obtenerCorrectaRevelada: vi.fn(async () => 1)
  } satisfies PuertoJuego;
}

function crearPuertoAdmin() {
  return {
    ajustarDuracion: vi.fn(async () => sala),
    guardarPreguntas: vi.fn(async () => undefined),
    iniciarRonda: vi.fn(async () => sala),
    revelarRonda: vi.fn(async () => ({ sala, indiceCorrecto: 1 })),
    avanzarRonda: vi.fn(async () => sala),
    reiniciarSala: vi.fn(async () => sala),
    expulsarJugador: vi.fn(async () => undefined),
    purgarSala: vi.fn(async () => undefined),
    obtenerPreguntasAdmin: vi.fn(async () => []),
    buscarSalaAdmin: vi.fn(async () => sala)
  } satisfies PuertoAdmin;
}

function crearPuertoSesion() {
  return {
    obtenerSesion: vi.fn(async (): Promise<Sesion | null> => null),
    iniciarAnonima: vi.fn(async () => sesionAnonima),
    iniciarConPassword: vi.fn(async () => sesionAdmin),
    registrarConPassword: vi.fn(async () => sesionAdmin),
    cerrarSesion: vi.fn(async () => undefined),
    escuchar: vi.fn(() => () => undefined)
  } satisfies PuertoSesion;
}

const reloj: Reloj = {
  ahora: () => new Date('2026-01-01T00:00:00.000Z'),
  sincronizar: vi.fn(async () => undefined)
};

describe('ServicioSala', () => {
  it('rechaza duraciones no permitidas', async () => {
    const puerto = crearPuertoSalas();
    const servicio = new ServicioSala(puerto);

    await expect(servicio.crear(20)).rejects.toMatchObject({ codigo: 'DURACION_INVALIDA' });
    expect(puerto.crearSala).not.toHaveBeenCalled();
  });

  it('normaliza el código y el nombre antes de unirse', async () => {
    const puerto = crearPuertoSalas();
    const servicio = new ServicioSala(puerto);

    await servicio.unirse(' abc123 ', '  Ana <b> ');

    expect(puerto.unirseASala).toHaveBeenCalledWith('ABC123', 'Ana b');
  });

  it('rechaza códigos inválidos', async () => {
    const servicio = new ServicioSala(crearPuertoSalas());

    await expect(servicio.unirse('123', 'Ana')).rejects.toMatchObject({ codigo: 'CODIGO_INVALIDO' });
  });

  it('rechaza nombres demasiado cortos', async () => {
    const servicio = new ServicioSala(crearPuertoSalas());

    await expect(servicio.unirse('ABC123', 'A')).rejects.toMatchObject({ codigo: 'NOMBRE_INVALIDO' });
  });
});

describe('ServicioJuego', () => {
  it('rechaza opciones fuera de rango', async () => {
    const puerto = crearPuertoJuego();
    const servicio = new ServicioJuego(puerto, reloj);

    await expect(servicio.responder('sala-1', 0, 4)).rejects.toMatchObject({
      codigo: 'OPCION_INVALIDA'
    });
    expect(puerto.enviarRespuesta).not.toHaveBeenCalled();
  });

  it('rechaza rondas fuera de rango', async () => {
    const servicio = new ServicioJuego(crearPuertoJuego(), reloj);

    await expect(servicio.responder('sala-1', 5, 0)).rejects.toMatchObject({
      codigo: 'RONDA_INVALIDA'
    });
  });

  it('envía una respuesta válida', async () => {
    const puerto = crearPuertoJuego();
    const servicio = new ServicioJuego(puerto, reloj);

    const resultado = await servicio.responder('sala-1', 0, 2);

    expect(resultado).toEqual(respuesta);
    expect(puerto.enviarRespuesta).toHaveBeenCalledWith('sala-1', 0, 2);
  });

  it('calcula los segundos restantes con el reloj inyectado', () => {
    const servicio = new ServicioJuego(crearPuertoJuego(), reloj);

    expect(servicio.segundosRestantes('2026-01-01T00:00:10.000Z')).toBe(10);
    expect(servicio.segundosRestantes(null)).toBe(0);
    expect(servicio.segundosRestantes('fecha-invalida')).toBe(0);
  });
});

describe('ServicioAdmin', () => {
  it('rechaza duraciones no permitidas', async () => {
    const servicio = new ServicioAdmin(crearPuertoAdmin());

    await expect(servicio.ajustarDuracion('sala-1', 20)).rejects.toMatchObject({
      codigo: 'DURACION_INVALIDA'
    });
  });

  it('rechaza preguntas inválidas', async () => {
    const puerto = crearPuertoAdmin();
    const servicio = new ServicioAdmin(puerto);

    await expect(servicio.guardarPreguntas('sala-1', [])).rejects.toMatchObject({
      codigo: 'PREGUNTAS_INVALIDAS'
    });
    expect(puerto.guardarPreguntas).not.toHaveBeenCalled();
  });

  it('guarda cinco preguntas válidas', async () => {
    const puerto = crearPuertoAdmin();
    const servicio = new ServicioAdmin(puerto);
    const preguntas = crearPreguntasPorDefecto();

    await servicio.guardarPreguntas('sala-1', preguntas);

    expect(puerto.guardarPreguntas).toHaveBeenCalledWith('sala-1', preguntas);
  });

  it('normaliza el código al buscar una sala', async () => {
    const puerto = crearPuertoAdmin();
    const servicio = new ServicioAdmin(puerto);

    await servicio.buscarPorCodigo(' abc123 ');

    expect(puerto.buscarSalaAdmin).toHaveBeenCalledWith('ABC123');
  });

  it('rechaza códigos inválidos al buscar una sala', async () => {
    const puerto = crearPuertoAdmin();
    const servicio = new ServicioAdmin(puerto);

    await expect(servicio.buscarPorCodigo('123')).rejects.toMatchObject({
      codigo: 'CODIGO_INVALIDO'
    });
    expect(puerto.buscarSalaAdmin).not.toHaveBeenCalled();
  });
});

describe('ServicioSesion', () => {
  it('reutiliza una sesión anónima existente', async () => {
    const puerto = crearPuertoSesion();
    puerto.obtenerSesion.mockResolvedValue(sesionAnonima);
    const servicio = new ServicioSesion(puerto);

    const sesion = await servicio.entrarAnonima();

    expect(sesion).toEqual(sesionAnonima);
    expect(puerto.iniciarAnonima).not.toHaveBeenCalled();
  });

  it('cierra una sesión de admin antes de entrar como anónimo', async () => {
    const puerto = crearPuertoSesion();
    puerto.obtenerSesion.mockResolvedValue(sesionAdmin);
    const servicio = new ServicioSesion(puerto);

    await servicio.entrarAnonima();

    expect(puerto.cerrarSesion).toHaveBeenCalledOnce();
    expect(puerto.iniciarAnonima).toHaveBeenCalledOnce();
  });

  it('valida las credenciales antes de entrar como admin', async () => {
    const puerto = crearPuertoSesion();
    const servicio = new ServicioSesion(puerto);

    await expect(servicio.entrarAdmin('correo', '123')).rejects.toMatchObject({
      codigo: 'CREDENCIALES_INVALIDAS'
    });
    expect(puerto.iniciarConPassword).not.toHaveBeenCalled();
  });

  it('entra como admin con credenciales válidas', async () => {
    const puerto = crearPuertoSesion();
    const servicio = new ServicioSesion(puerto);

    const sesion = await servicio.entrarAdmin(' admin@test.local ', 'secreto');

    expect(sesion).toEqual(sesionAdmin);
    expect(puerto.iniciarConPassword).toHaveBeenCalledWith('admin@test.local', 'secreto');
  });

  it('cierra la sesión anónima antes de registrar un admin', async () => {
    const puerto = crearPuertoSesion();
    puerto.obtenerSesion.mockResolvedValue(sesionAnonima);
    const servicio = new ServicioSesion(puerto);

    await servicio.registrarAdmin('admin@test.local', 'secreto');

    expect(puerto.cerrarSesion).toHaveBeenCalledOnce();
    expect(puerto.registrarConPassword).toHaveBeenCalledWith('admin@test.local', 'secreto');
  });
});
