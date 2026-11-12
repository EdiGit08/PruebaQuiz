import confetti from 'canvas-confetti';
import type { ServiciosApp } from '../infrastructure/crearServicios';
import {
  DURACION_POR_DEFECTO,
  ErrorDominio,
  TOTAL_PREGUNTAS,
  ordenarRanking,
  obtenerTop
} from '../domain';
import type {
  Jugador,
  Pregunta,
  PreguntaAdmin,
  PreguntaEditable,
  Respuesta,
  Sala,
  TipoMinijuego
} from '../domain';
import { SoundFX } from './audio/SoundFX';
import { crear, establecerTexto, leerValor, limpiar, mostrar, mostrarModal, porId } from './dom';
import { MiniGame1Kahoot } from './minigames/MiniGame1_Kahoot';
import {
  crearJuego2,
  crearJuego3,
  crearJuego4,
  crearJuego5,
  type JuegoCanon,
  type JuegoCanvas,
  type JuegoCintas
} from './minigames/canvasGames';
import type { PreguntaMinijuego } from './minigames/types';

const CODIGO_ADMIN_OCULTO = 'ADM123';
const NOMBRE_ADMIN_OCULTO = 'adminquiz#';

const TITULOS: Record<TipoMinijuego, string> = {
  kahoot: 'Kahoot clásico',
  plataformas: 'Plataformas 2D',
  nave: 'Nave espacial',
  cintas: 'Cintas transportadoras',
  canon: 'El cañón'
};

interface ResultadoRonda {
  acierto: boolean;
  puntos: number;
  correcta: string;
}

interface OpcionesCarga {
  iniciarTemporizador?: boolean;
}

export class AppController {
  private readonly sound = new SoundFX();
  private sala: Sala | null = null;
  private jugador: Jugador | null = null;
  private jugadores: Jugador[] = [];
  private esAdmin = false;
  private sesionUsuarioId: string | null = null;
  private preguntasAdmin: PreguntaAdmin[] = [];
  private preguntaActual: Pregunta | null = null;
  private miRespuesta: Respuesta | null = null;
  private indiceCorrecto: number | null = null;
  private resultadoRonda: ResultadoRonda | null = null;
  private gameStarted = false;
  private rondaEvaluada = false;
  private rondaCargada = -1;
  private puntosAntes = 0;
  private podioMostrado = false;
  private timerInterval: number | null = null;
  private toastTimeout: number | null = null;
  private unsubscribeSala: (() => void) | null = null;
  private juego1: MiniGame1Kahoot | null = null;
  private juegoCanvas: JuegoCanvas | null = null;
  private juegoCintas: JuegoCintas | null = null;
  private juegoCanon: JuegoCanon | null = null;
  private editorTab = 0;
  private enviandoSeleccion = false;
  private seleccionPendiente: number | null = null;
  private tieneSeleccionPendiente = false;
  private autoRevelando = false;

  constructor(private readonly servicios: ServiciosApp) {}

  async iniciar(): Promise<void> {
    this.registrarEventos();
    this.iniciarAnimacion();
    this.actualizarConexion(true, 'Todo listo para jugar');
    try {
      const sesion = await this.servicios.sesion.restaurar();
      if (!sesion) {
        this.mostrarInicio();
        return;
      }
      this.sesionUsuarioId = sesion.usuarioId;
      if (sesion.esAnonimo) {
        await this.restaurarJugador();
      } else {
        await this.restaurarAdmin();
      }
    } catch (error) {
      this.mostrarError(error);
      this.mostrarInicio();
    }
  }

  private registrarEventos(): void {
    porId<HTMLFormElement>('formJugador').addEventListener('submit', (evento) => {
      evento.preventDefault();
      void this.entrarJugador();
    });
    porId<HTMLFormElement>('formAdmin').addEventListener('submit', (evento) => {
      evento.preventDefault();
      void this.entrarAdmin();
    });
    porId('btnRegistrarAdmin').addEventListener('click', () => {
      void this.registrarAdmin();
    });
    porId('btnVolverInicioAdmin').addEventListener('click', () => {
      this.limpiarError('errorAdmin');
      this.mostrarInicio();
    });
    porId('btnCrearSala').addEventListener('click', () => {
      void this.crearSala();
    });
    porId('btnAbrirSala').addEventListener('click', () => {
      void this.abrirSalaPorCodigo(leerValor('inputCodigoAdmin'));
    });
    porId('btnCopiarEnlace').addEventListener('click', () => {
      void this.copiarEnlace();
    });
    porId('btnLogout').addEventListener('click', () => {
      void this.salir();
    });
    porId('btnToggleMute').addEventListener('click', () => {
      this.alternarSonido();
    });
    porId('btnAdminNext').addEventListener('click', () => {
      void this.accionAdmin();
    });
    porId('btnLobbyStartQuiz').addEventListener('click', () => {
      void this.accionAdmin();
    });
    porId('btnIntermissionNextAdmin').addEventListener('click', () => {
      void this.accionAdmin();
    });
    porId('btnPlayAgain').addEventListener('click', () => {
      void this.reiniciarSala();
    });
    porId('btnOpenQuestionEditor').addEventListener('click', () => {
      void this.abrirEditor();
    });
    porId('btnLobbyEditQuestions').addEventListener('click', () => {
      void this.abrirEditor();
    });
    porId('btnSaveQuestions').addEventListener('click', () => {
      void this.guardarEditor();
    });
    porId('btnManagePlayers').addEventListener('click', () => {
      this.renderPlayerManager();
      mostrarModal(porId('modalPlayerManager'), true);
    });
    porId('btnClosePlayerManager').addEventListener('click', () => {
      mostrarModal(porId('modalPlayerManager'), false);
    });
    porId('btnCloseEditorModal').addEventListener('click', () => {
      mostrarModal(porId('modalQuestionEditor'), false);
    });
    porId('btnRestoreShot').addEventListener('click', () => {
      this.juegoCanon?.restoreSelection();
      this.mostrarToast('Disparo restaurado. ¡Apunta y dispara de nuevo!');
    });
    porId<HTMLSelectElement>('adminTimeSelect').addEventListener('change', () => {
      void this.ajustarDuracion();
    });
    this.registrarCierreModal('modalQuestionEditor');
    this.registrarCierreModal('modalPlayerManager');
    this.registrarControlesCanvas();
    this.registrarTeclado();
  }

  private registrarCierreModal(id: string): void {
    const modal = porId(id);
    modal.addEventListener('click', (evento) => {
      if (evento.target === modal) mostrarModal(modal, false);
    });
  }

  private registrarControlesCanvas(): void {
    this.enlazarBotonMantener('btnTouchLeft', 'left');
    this.enlazarBotonMantener('btnTouchRight', 'right');
    this.enlazarBotonMantener('btnTouchUp', 'up');
    this.enlazarBotonMantener('btnTouchDown', 'down');
    porId('btnTouchAction').addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      this.juegoCanvas?.setInput('action', true);
    });
    document.querySelectorAll<HTMLButtonElement>('.lane-btn').forEach((boton) => {
      boton.addEventListener('click', () => {
        const carril = Number(boton.dataset.lane ?? 0);
        this.juegoCintas?.selectLane(carril);
      });
    });
    window.addEventListener('resize', () => {
      this.juegoCanvas?.resize();
    });
  }

  private enlazarBotonMantener(id: string, direccion: string): void {
    const boton = porId(id);
    boton.addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      this.juegoCanvas?.setInput(direccion, true);
    });
    boton.addEventListener('pointerup', () => {
      this.juegoCanvas?.setInput(direccion, false);
    });
    boton.addEventListener('pointerleave', () => {
      this.juegoCanvas?.setInput(direccion, false);
    });
  }

  private registrarTeclado(): void {
    window.addEventListener('keydown', (evento) => {
      if (!this.juegoCanvas) return;
      const escribiendo = document.activeElement?.tagName === 'INPUT';
      if (evento.key === 'ArrowLeft' || evento.key.toLowerCase() === 'a') {
        this.juegoCanvas.setInput('left', true);
      } else if (evento.key === 'ArrowRight' || evento.key.toLowerCase() === 'd') {
        this.juegoCanvas.setInput('right', true);
      } else if (evento.key === 'ArrowUp' || evento.key.toLowerCase() === 'w') {
        if (!escribiendo) {
          evento.preventDefault();
          if (this.sala?.rondaActual === 2) {
            this.juegoCanvas.setInput('up', true);
          } else {
            this.juegoCanvas.setInput('action', true);
          }
        }
      } else if (evento.key === 'ArrowDown' || evento.key.toLowerCase() === 's') {
        if (!escribiendo && this.sala?.rondaActual === 2) {
          evento.preventDefault();
          this.juegoCanvas.setInput('down', true);
        }
      } else if (evento.key === ' ') {
        if (!escribiendo) {
          evento.preventDefault();
          this.juegoCanvas.setInput('action', true);
        }
      } else if (['1', '2', '3', '4'].includes(evento.key) && this.sala?.rondaActual === 3) {
        this.juegoCintas?.selectLane(Number(evento.key) - 1);
      }
    });
    window.addEventListener('keyup', (evento) => {
      if (!this.juegoCanvas) return;
      if (evento.key === 'ArrowLeft' || evento.key.toLowerCase() === 'a') {
        this.juegoCanvas.setInput('left', false);
      } else if (evento.key === 'ArrowRight' || evento.key.toLowerCase() === 'd') {
        this.juegoCanvas.setInput('right', false);
      } else if (evento.key === 'ArrowUp' || evento.key.toLowerCase() === 'w') {
        this.juegoCanvas.setInput('up', false);
      } else if (evento.key === 'ArrowDown' || evento.key.toLowerCase() === 's') {
        this.juegoCanvas.setInput('down', false);
      }
    });
  }

  private iniciarAnimacion(): void {
    const bucle = (): void => {
      if (this.juegoCanvas?.running) {
        this.juegoCanvas.update();
        this.juegoCanvas.draw();
      }
      window.requestAnimationFrame(bucle);
    };
    window.requestAnimationFrame(bucle);
  }

  private async entrarJugador(): Promise<void> {
    this.sound.init();
    this.limpiarError('errorJugador');
    const nombre = leerValor('inputNombreJugador');
    const codigo = leerValor('inputCodigoSala');
    this.deshabilitar('btnUnirse', true);
    try {
      if (this.esAccesoAdminOculto(codigo, nombre)) {
        this.mostrarAdminLogin();
        return;
      }
      const sesion = await this.servicios.sesion.entrarAnonima();
      this.sesionUsuarioId = sesion.usuarioId;
      const resultado = await this.servicios.sala.unirse(codigo, nombre);
      this.jugador = resultado.jugador;
      this.guardarIdentidadJugador(nombre, codigo);
      await this.abrirSala(resultado.sala);
    } catch (error) {
      this.mostrarErrorFormulario('errorJugador', error);
    } finally {
      this.deshabilitar('btnUnirse', false);
    }
  }

  private esAccesoAdminOculto(codigo: string, nombre: string): boolean {
    return (
      codigo.trim().toUpperCase() === CODIGO_ADMIN_OCULTO &&
      nombre.trim().toLowerCase() === NOMBRE_ADMIN_OCULTO
    );
  }

  private mostrarAdminLogin(): void {
    this.sound.init();
    this.mostrarSolo('screenAdminLogin');
    mostrar(porId('adminControlBar'), false);
    mostrar(porId('playerHudBar'), false);
    mostrar(porId('btnLogout'), Boolean(this.sesionUsuarioId));
    porId('btnLogout').classList.add('flex');
    porId<HTMLInputElement>('inputAdminEmail').focus();
  }

  private async entrarAdmin(): Promise<void> {
    this.sound.init();
    this.limpiarError('errorAdmin');
    const email = leerValor('inputAdminEmail');
    const password = porId<HTMLInputElement>('inputAdminPassword').value;
    this.deshabilitar('btnEntrarAdmin', true);
    try {
      const sesion = await this.servicios.sesion.entrarAdmin(email, password);
      this.sesionUsuarioId = sesion.usuarioId;
      this.esAdmin = true;
      await this.prepararAdmin();
    } catch (error) {
      this.mostrarErrorFormulario('errorAdmin', error);
    } finally {
      this.deshabilitar('btnEntrarAdmin', false);
    }
  }

  private async registrarAdmin(): Promise<void> {
    this.sound.init();
    this.limpiarError('errorAdmin');
    const email = leerValor('inputAdminEmail');
    const password = porId<HTMLInputElement>('inputAdminPassword').value;
    this.deshabilitar('btnRegistrarAdmin', true);
    try {
      const sesion = await this.servicios.sesion.registrarAdmin(email, password);
      this.sesionUsuarioId = sesion.usuarioId;
      this.esAdmin = true;
      this.mostrarToast('Cuenta creada. Ya puedes administrar salas.');
      await this.prepararAdmin();
    } catch (error) {
      this.mostrarErrorFormulario('errorAdmin', error);
    } finally {
      this.deshabilitar('btnRegistrarAdmin', false);
    }
  }

  private async restaurarJugador(): Promise<void> {
    const codigo = this.codigoUrl() ?? localStorage.getItem('pq_codigo') ?? '';
    const nombre = localStorage.getItem('pq_nombre') ?? '';
    if (!codigo || !nombre) {
      this.mostrarInicio();
      porId<HTMLInputElement>('inputCodigoSala').value = codigo;
      return;
    }
    try {
      const resultado = await this.servicios.sala.unirse(codigo, nombre);
      this.jugador = resultado.jugador;
      await this.abrirSala(resultado.sala);
    } catch (error) {
      localStorage.removeItem('pq_codigo');
      this.mostrarInicio();
      porId<HTMLInputElement>('inputCodigoSala').value = codigo;
      this.mostrarErrorFormulario('errorJugador', error);
    }
  }

  private async restaurarAdmin(): Promise<void> {
    this.esAdmin = true;
    const salaId = localStorage.getItem('pq_sala_id');
    if (salaId) {
      try {
        const sala = await this.servicios.sala.obtener(salaId);
        if (sala) {
          await this.abrirSala(sala);
          return;
        }
      } catch (error) {
        this.mostrarError(error);
      }
    }
    const codigo = this.codigoUrl() ?? localStorage.getItem('pq_sala_codigo') ?? '';
    if (codigo) {
      try {
        const sala = await this.servicios.admin.buscarPorCodigo(codigo);
        if (sala) {
          await this.abrirSala(sala);
          return;
        }
      } catch (error) {
        this.mostrarError(error);
      }
    }
    await this.prepararAdmin();
  }

  private async prepararAdmin(): Promise<void> {
    this.mostrarSolo('screenAdminPanel');
    mostrar(porId('panelAdminSala'), true);
    mostrar(porId('adminControlBar'), false);
    mostrar(porId('playerHudBar'), false);
    mostrar(porId('btnLogout'), true);
    porId('btnLogout').classList.add('flex');
    porId<HTMLInputElement>('inputCodigoAdmin').value =
      this.codigoUrl() ?? localStorage.getItem('pq_sala_codigo') ?? '';
  }

  private async crearSala(): Promise<void> {
    if (!this.esAdmin) return;
    this.deshabilitar('btnCrearSala', true);
    try {
      const sala = await this.servicios.sala.crear(DURACION_POR_DEFECTO);
      await this.abrirSala(sala);
    } catch (error) {
      this.mostrarError(error);
    } finally {
      this.deshabilitar('btnCrearSala', false);
    }
  }

  private async abrirSalaPorCodigo(codigo: string): Promise<void> {
    if (!this.esAdmin) return;
    this.deshabilitar('btnAbrirSala', true);
    try {
      const sala = await this.servicios.admin.buscarPorCodigo(codigo);
      if (!sala) {
        this.mostrarToast('No existe una sala con ese código.');
        return;
      }
      await this.abrirSala(sala);
    } catch (error) {
      this.mostrarError(error);
    } finally {
      this.deshabilitar('btnAbrirSala', false);
    }
  }

  private async abrirSala(sala: Sala): Promise<void> {
    try {
      await this.servicios.juego.sincronizarReloj();
    } catch (error) {
      this.mostrarError(error);
    }
    this.sala = sala;
    this.gameStarted = false;
    this.rondaCargada = -1;
    this.rondaEvaluada = false;
    this.podioMostrado = false;
    localStorage.setItem('pq_sala_id', sala.id);
    localStorage.setItem('pq_sala_codigo', sala.codigo);
    this.suscribirSala(sala.id);
    await this.refrescarJugadores();
    if (this.esAdmin) await this.refrescarPreguntasAdmin();
    this.mostrarSolo('screenEspera');
    await this.manejarSala(sala, true);
  }

  private suscribirSala(salaId: string): void {
    this.unsubscribeSala?.();
    this.unsubscribeSala = this.servicios.tiempoReal.suscribirSala(salaId, {
      alCambiarSala: (sala) => {
        void this.manejarSala(sala);
      },
      alCambiarJugadores: () => {
        void this.refrescarJugadores();
      },
      alCambiarConexion: (conectado) => {
        this.actualizarConexion(conectado, conectado ? 'Todo listo para jugar' : 'Reconectando...');
      },
      alError: (error) => {
        this.mostrarError(error);
      }
    });
  }

  private async manejarSala(sala: Sala, inicial = false): Promise<void> {
    const anterior = this.sala;
    const cambioEstado = !anterior || anterior.estado !== sala.estado;
    const cambioRonda = !anterior || anterior.rondaActual !== sala.rondaActual;
    this.sala = sala;
    this.actualizarCodigoSala();
    this.actualizarBarras();

    if (sala.estado === 'WAITING') {
      this.detenerMinijuego();
      this.gameStarted = false;
      this.rondaCargada = -1;
      this.rondaEvaluada = false;
      this.podioMostrado = false;
      this.preguntaActual = null;
      this.miRespuesta = null;
      this.indiceCorrecto = null;
      this.resultadoRonda = null;
      this.mostrarSolo('screenEspera');
      this.renderWaitingRoom();
      await this.actualizarContadores();
      return;
    }

    if (sala.estado === 'IN_GAME') {
      this.mostrarSolo('screenJuego');
      if (!this.gameStarted || cambioEstado || cambioRonda || inicial) {
        await this.cargarRonda(sala.rondaActual);
      } else {
        this.iniciarTemporizador();
      }
      return;
    }

    if (sala.estado === 'REVEALED') {
      this.mostrarSolo('screenJuego');
      if (!this.gameStarted || this.rondaCargada !== sala.rondaActual || cambioRonda) {
        await this.cargarRonda(sala.rondaActual, { iniciarTemporizador: false });
      }
      await this.revelarLocal();
      return;
    }

    this.detenerMinijuego();
    this.gameStarted = false;
    this.mostrarSolo('screenPodio');
    this.actualizarBotonAdmin();
    this.renderPodium();
  }

  private async cargarRonda(ronda: number, opciones: OpcionesCarga = {}): Promise<void> {
    const sala = this.requerirSala();
    this.detenerMinijuego();
    this.gameStarted = true;
    this.rondaCargada = ronda;
    this.rondaEvaluada = false;
    this.indiceCorrecto = null;
    this.miRespuesta = null;
    this.preguntaActual = null;
    this.resultadoRonda = null;
    this.puntosAntes = this.jugador?.puntaje ?? 0;
    this.mostrarSolo('screenJuego');
    this.actualizarCabecera(ronda);
    const pregunta = await this.obtenerPreguntaRonda(ronda);
    if (!pregunta) {
      this.mostrarToast('La pregunta de esta ronda no está disponible.');
      return;
    }
    this.preguntaActual = pregunta;
    this.actualizarCabecera(ronda);
    if (!this.esAdmin) {
      this.miRespuesta = await this.servicios.sala.obtenerMiRespuesta(sala.id, ronda);
    }
    this.prepararMinijuego(pregunta);
    this.actualizarBarras();
    this.actualizarHud();
    await this.actualizarContadores();
    if (opciones.iniciarTemporizador !== false) this.iniciarTemporizador();
  }

  private async obtenerPreguntaRonda(ronda: number): Promise<Pregunta | null> {
    const sala = this.requerirSala();
    if (this.esAdmin) {
      if (this.preguntasAdmin.length === 0) await this.refrescarPreguntasAdmin();
      const pregunta = this.preguntasAdmin.find((item) => item.posicion === ronda);
      if (pregunta) return pregunta;
    }
    return this.servicios.sala.obtenerPregunta(sala.id, ronda);
  }

  private actualizarCabecera(ronda: number): void {
    const titulo = this.preguntaActual ? TITULOS[this.preguntaActual.tipoMinijuego] : `Reto ${ronda + 1}`;
    establecerTexto('badgeRoundNumber', `RETO ${ronda + 1}/${TOTAL_PREGUNTAS}`);
    establecerTexto('badgeMiniGameType', titulo);
    establecerTexto('hudGameTitle', `Reto ${ronda + 1} de ${TOTAL_PREGUNTAS}`);
    establecerTexto('questionHeading', this.preguntaActual?.texto ?? '');
    establecerTexto('timerNumber', `${this.sala?.duracionSeg ?? DURACION_POR_DEFECTO}s`);
    this.actualizarChip('En curso · Elige una opción', 'verde');
    this.actualizarBotonAdmin();
  }

  private prepararMinijuego(pregunta: Pregunta): void {
    const adaptada: PreguntaMinijuego = { options: pregunta.opciones, correctIndex: -1 };
    const containerGame1 = porId('containerGame1');
    const containerCanvas = porId('containerCanvasGames');
    const canvas = porId<HTMLCanvasElement>('gameCanvas');
    const laneButtons = porId('laneQuickButtons');
    const btnUp = porId('btnTouchUp');
    const btnDown = porId('btnTouchDown');
    const btnAction = porId('btnTouchAction');
    const btnRestore = porId('btnRestoreShot');
    const hint = porId('canvasTopHint');
    const actionText = porId('btnTouchActionText');

    mostrar(laneButtons, false);
    mostrar(btnUp, false);
    mostrar(btnDown, false);
    mostrar(btnRestore, false);
    mostrar(btnAction, true);
    mostrar(containerGame1, this.sala?.rondaActual === 0);
    mostrar(containerCanvas, this.sala?.rondaActual !== 0);
    this.juegoCanvas = null;

    if (this.sala?.rondaActual === 0) {
      this.juego1 = new MiniGame1Kahoot(containerGame1, (indice) => this.onSeleccion(indice), this.sound);
      this.juego1.start(adaptada);
      return;
    }

    const onSelect = (indice: number | null): void => this.onSeleccion(indice);
    if (this.sala?.rondaActual === 1) {
      this.juegoCanvas = crearJuego2(canvas, onSelect, this.sound);
      actionText.textContent = 'SALTAR (ESPACIO / ↑)';
      hint.textContent = 'Salta y quédate sobre la plataforma con la respuesta correcta';
    } else if (this.sala?.rondaActual === 2) {
      this.juegoCanvas = crearJuego3(canvas, onSelect, this.sound);
      mostrar(btnUp, true);
      mostrar(btnDown, true);
      mostrar(btnAction, false);
      hint.textContent = 'Muévete libremente (↑ ↓ ← →). Se tomará la puerta donde estés al acabar';
    } else if (this.sala?.rondaActual === 3) {
      this.juegoCintas = crearJuego4(canvas, onSelect, this.sound);
      this.juegoCanvas = this.juegoCintas;
      mostrar(laneButtons, true);
      mostrar(btnAction, false);
      hint.textContent = 'Elige tu carril (1-4 o flechas). Las opciones bajarán al llegar a 0';
    } else {
      this.juegoCanon = crearJuego5(canvas, onSelect, this.sound, (bloqueado) => {
        mostrar(btnRestore, bloqueado && !this.rondaEvaluada);
      });
      this.juegoCanvas = this.juegoCanon;
      actionText.textContent = 'DISPARAR CAÑÓN (ESPACIO)';
      hint.textContent = 'Apunta y dispara al globo correcto. Puedes restaurar tu tiro';
    }
    this.juegoCanvas.start(adaptada);
  }

  private iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.tickTemporizador();
    this.timerInterval = window.setInterval(() => this.tickTemporizador(), 200);
  }

  private tickTemporizador(): void {
    const sala = this.sala;
    if (!sala || sala.estado !== 'IN_GAME' || this.rondaEvaluada) return;
    const restantes = this.servicios.juego.segundosRestantes(sala.finRonda);
    this.actualizarTemporizador(restantes, sala.duracionSeg);
    if (restantes <= 0) {
      this.detenerTemporizador();
      this.marcarTiempoAgotado();
    }
  }

  private actualizarTemporizador(restantes: number, duracion: number): void {
    establecerTexto('timerNumber', `${Math.ceil(restantes)}s`);
    const porcentaje = duracion > 0 ? Math.max(0, (restantes / duracion) * 100) : 0;
    porId('timerProgressBar').style.width = `${porcentaje}%`;
  }

  private marcarTiempoAgotado(): void {
    this.actualizarTemporizador(0, this.sala?.duracionSeg ?? DURACION_POR_DEFECTO);
    this.actualizarChip('¡Tiempo agotado!', 'ambar');
    if (!this.esAdmin || this.autoRevelando) return;
    if (this.sala?.rondaActual === 3 && this.juegoCintas) {
      this.juegoCintas.triggerDropWhenTimeZero(() => {
        void this.revelarRondaAdmin();
      });
      return;
    }
    void this.revelarRondaAdmin();
  }

  private async revelarRondaAdmin(): Promise<void> {
    if (!this.esAdmin || !this.sala || this.autoRevelando) return;
    this.autoRevelando = true;
    try {
      const resultado = await this.servicios.admin.revelar(this.sala.id);
      this.sala = resultado.sala;
      this.indiceCorrecto = resultado.indiceCorrecto;
      await this.refrescarJugadores();
      await this.revelarLocal();
    } catch (error) {
      if (!(error instanceof ErrorDominio) || error.codigo !== 'TRANSICION_INVALIDA') {
        this.mostrarError(error);
      }
    } finally {
      this.autoRevelando = false;
    }
  }

  private async revelarLocal(): Promise<void> {
    const sala = this.sala;
    const pregunta = this.preguntaActual;
    if (!sala || !pregunta || this.rondaEvaluada) return;
    this.rondaEvaluada = true;
    this.detenerTemporizador();
    this.actualizarTemporizador(0, sala.duracionSeg);
    if (this.indiceCorrecto === null && this.esAdmin) {
      const preguntaAdmin = this.preguntasAdmin.find((item) => item.posicion === sala.rondaActual);
      this.indiceCorrecto = preguntaAdmin?.indiceCorrecto ?? null;
    }
    if (this.indiceCorrecto === null) {
      this.indiceCorrecto = await this.servicios.juego.correcta(sala.id);
    }
    const correcta = this.indiceCorrecto;
    if (correcta === null) {
      this.mostrarToast('No se pudo obtener la respuesta correcta.');
      return;
    }
    this.revelarMinijuego(correcta);
    const miOpcion = this.miRespuesta?.opcion ?? null;
    const acierto = miOpcion !== null && miOpcion === correcta;
    if (this.jugador) {
      if (acierto) this.sound.correct();
      else this.sound.wrong();
    }
    await this.refrescarJugadores();
    this.actualizarHud();
    const puntos = this.jugador ? Math.max(0, this.jugador.puntaje - this.puntosAntes) : 0;
    this.resultadoRonda = {
      acierto,
      puntos,
      correcta: pregunta.opciones[correcta] ?? ''
    };
    this.actualizarChip('Reto revelado', 'azul');
    this.actualizarBotonAdmin();
    window.setTimeout(() => {
      if (this.sala?.estado === 'REVEALED' && this.rondaEvaluada) this.mostrarResultados();
    }, 1400);
  }

  private revelarMinijuego(correcta: number): void {
    if (this.sala?.rondaActual === 0) {
      this.juego1?.reveal(correcta);
      return;
    }
    this.juegoCanvas?.reveal(correcta);
  }

  private onSeleccion(indice: number | null): void {
    if (!this.puedeResponder()) return;
    if (indice === null) {
      this.actualizarChip('Selección restaurada · Elige de nuevo', 'ambar');
    } else {
      this.actualizarChip(`Opción ${indice + 1} seleccionada`, 'indigo');
    }
    this.encolarSeleccion(indice);
  }

  private puedeResponder(): boolean {
    return Boolean(
      this.jugador &&
        !this.esAdmin &&
        this.sala?.estado === 'IN_GAME' &&
        !this.rondaEvaluada
    );
  }

  private encolarSeleccion(opcion: number | null): void {
    this.seleccionPendiente = opcion;
    this.tieneSeleccionPendiente = true;
    void this.procesarSeleccion();
  }

  private async procesarSeleccion(): Promise<void> {
    if (this.enviandoSeleccion) return;
    this.enviandoSeleccion = true;
    try {
      while (this.tieneSeleccionPendiente) {
        const sala = this.sala;
        const opcion = this.seleccionPendiente;
        this.tieneSeleccionPendiente = false;
        if (!sala || sala.estado !== 'IN_GAME' || this.rondaEvaluada) break;
        if (opcion === null) {
          await this.servicios.juego.anular(sala.id, sala.rondaActual);
          this.miRespuesta = null;
        } else {
          this.miRespuesta = await this.servicios.juego.responder(
            sala.id,
            sala.rondaActual,
            opcion
          );
        }
        await this.actualizarContadores();
      }
    } catch (error) {
      if (error instanceof ErrorDominio && (error.codigo === 'FUERA_DE_TIEMPO' || error.codigo === 'RONDA_NO_ACTIVA')) {
        this.actualizarChip('Se acabó el tiempo del reto', 'ambar');
      } else {
        this.mostrarError(error);
      }
    } finally {
      this.enviandoSeleccion = false;
    }
  }

  private mostrarResultados(): void {
    const resultado = this.resultadoRonda;
    if (!resultado) return;
    this.mostrarSolo('screenResultados');
    const tarjeta = porId('intermissionPlayerCard');
    const icono = porId('intermissionIcon');
    const titulo = porId('intermissionTitle');
    const subtitulo = porId('intermissionSubtitle');

    if (this.esAdmin) {
      tarjeta.className =
        'rounded-2xl border border-sky-400/40 bg-sky-500/10 p-5 text-center shadow-lg';
      icono.className = 'ph-fill ph-chart-bar mb-2 block text-4xl text-sky-300 sm:text-5xl';
      titulo.textContent = `Respuesta correcta: "${resultado.correcta}"`;
      subtitulo.textContent = 'Los jugadores ya pueden ver su resultado. Avanza cuando estés listo.';
    } else if (resultado.acierto) {
      tarjeta.className =
        'rounded-2xl border border-mint-400/50 bg-mint-500/10 p-5 text-center shadow-lg';
      icono.className = 'ph-fill ph-check-circle mb-2 block text-4xl text-mint-300 sm:text-5xl';
      titulo.textContent = `¡Respuesta correcta! +${resultado.puntos} pts`;
      subtitulo.textContent = `Sumaste ${resultado.puntos} puntos a tu puntaje total`;
    } else {
      tarjeta.className =
        'rounded-2xl border border-coral-400/50 bg-coral-500/10 p-5 text-center shadow-lg';
      icono.className = 'ph-fill ph-x-circle mb-2 block text-4xl text-coral-400 sm:text-5xl';
      titulo.textContent = this.miRespuesta ? 'Respuesta incorrecta (+0 pts)' : 'Sin respuesta (+0 pts)';
      subtitulo.textContent = `La opción correcta era: "${resultado.correcta}"`;
    }

    mostrar(porId('btnIntermissionNextAdmin'), this.esAdmin);
    mostrar(porId('intermissionWaitingMsg'), !this.esAdmin);
    establecerTexto('intermissionRoundLabel', `Reto ${(this.sala?.rondaActual ?? 0) + 1} de ${TOTAL_PREGUNTAS}`);
    this.renderTop10();
  }

  private renderTop10(): void {
    const contenedor = porId('intermissionTop10List');
    limpiar(contenedor);
    const top = obtenerTop(this.jugadores, 10);
    if (top.length === 0) {
      contenedor.appendChild(
        crear('div', 'p-4 text-center text-xs text-slate-400', 'Sin jugadores en el ranking.')
      );
      return;
    }
    top.forEach((jugador, indice) => {
      contenedor.appendChild(this.crearFilaRanking(jugador, indice));
    });
  }

  private crearFilaRanking(jugador: Jugador, indice: number): HTMLElement {
    const fila = crear(
      'div',
      `flex items-center justify-between px-4 py-2.5 ${jugador.id === this.jugador?.id ? 'bg-mint-500/10' : ''}`
    );
    const izquierda = crear('div', 'flex min-w-0 items-center gap-3');
    izquierda.appendChild(this.crearInsigniaPuesto(indice));
    izquierda.appendChild(crear('span', 'truncate text-sm font-bold text-cream', jugador.nombre));
    if (jugador.id === this.jugador?.id) {
      izquierda.appendChild(
        crear('span', 'rounded bg-mint-500/20 px-2 py-0.5 text-[10px] font-bold text-mint-300', 'TÚ')
      );
    }
    const derecha = crear('div', 'flex shrink-0 items-center gap-3');
    derecha.appendChild(crear('span', 'font-arcade text-sm text-sun-300 sm:text-base', `${jugador.puntaje} pts`));
    fila.append(izquierda, derecha);
    return fila;
  }

  private crearInsigniaPuesto(indice: number): HTMLElement {
    const clase =
      indice === 0
        ? 'bg-sun-400 text-night-950'
        : indice === 1
          ? 'bg-slate-300 text-night-950'
          : indice === 2
            ? 'bg-coral-500 text-night-950'
            : 'bg-night-700 text-slate-300';
    return crear(
      'span',
      `w-6 h-6 rounded-lg ${clase} font-arcade text-xs flex items-center justify-center font-bold shrink-0`,
      String(indice + 1)
    );
  }

  private renderPodium(): void {
    const ranking = ordenarRanking(this.jugadores);
    const pedestales = porId('podiumPedestals');
    limpiar(pedestales);
    pedestales.append(
      this.crearPedestal(ranking[1] ?? null, 2),
      this.crearPedestal(ranking[0] ?? null, 1),
      this.crearPedestal(ranking[2] ?? null, 3)
    );
    establecerTexto('rankingTotalPlayers', `${ranking.length} participante(s)`);
    const lista = porId('rankingListContainer');
    limpiar(lista);
    if (ranking.length === 0) {
      lista.appendChild(
        crear('div', 'p-4 text-center text-xs text-slate-400', 'Sin jugadores registrados.')
      );
    } else {
      ranking.forEach((jugador, indice) => {
        lista.appendChild(this.crearFilaRanking(jugador, indice));
      });
    }
    mostrar(porId('podiumAdminControls'), this.esAdmin);
    if (!this.podioMostrado) {
      this.podioMostrado = true;
      this.sound.fanfare();
      confetti({ particleCount: 95, spread: 80, origin: { y: 0.6 } });
    }
  }

  private crearPedestal(jugador: Jugador | null, posicion: number): HTMLElement {
    const colores =
      posicion === 1
        ? { alto: 'h-40 sm:h-52', fondo: 'from-sun-300 via-sun-400 to-sun-500', medalla: 'bg-sun-400 text-night-950' }
        : posicion === 2
          ? { alto: 'h-28 sm:h-36', fondo: 'from-slate-200 to-slate-400', medalla: 'bg-slate-300 text-night-950' }
          : { alto: 'h-20 sm:h-28', fondo: 'from-coral-400 to-coral-600', medalla: 'bg-coral-500 text-night-950' };
    const contenedor = crear('div', 'flex flex-col items-center min-w-0');
    const info = crear('div', 'text-center mb-2 min-w-0');
    const medalla = crear(
      'div',
      `mx-auto rounded-2xl ${colores.medalla} font-arcade flex items-center justify-center shadow-lg border-2 border-white/70 mb-1 ${posicion === 1 ? 'w-14 h-14 text-2xl' : 'w-12 h-12 text-xl'}`,
      `${posicion}º`
    );
    info.appendChild(medalla);
    info.appendChild(
      crear(
        'p',
        `max-w-[110px] truncate text-xs font-bold text-cream sm:max-w-[150px] sm:text-sm ${posicion === 1 ? 'text-sun-300' : ''}`,
        jugador?.nombre ?? 'Vacante'
      )
    );
    info.appendChild(
      crear('span', 'font-arcade text-sm text-sun-200 sm:text-base', `${jugador?.puntaje ?? 0} pts`)
    );
    const barra = crear(
      'div',
      `podium-bar w-full ${colores.alto} rounded-t-2xl bg-gradient-to-b ${colores.fondo} border-t-4 border-white/80 flex items-center justify-center shadow-xl`,
      `${posicion}º`
    );
    barra.classList.add('font-arcade', 'text-3xl', 'text-night-950', 'font-bold');
    contenedor.append(info, barra);
    return contenedor;
  }

  private async accionAdmin(): Promise<void> {
    if (!this.esAdmin || !this.sala) return;
    try {
      const sala = this.sala;
      if (sala.estado === 'WAITING') {
        const actualizada = await this.servicios.admin.iniciar(sala.id);
        await this.manejarSala(actualizada);
      } else if (sala.estado === 'IN_GAME') {
        await this.revelarRondaAdmin();
      } else if (sala.estado === 'REVEALED') {
        const actualizada = await this.servicios.admin.avanzar(sala.id);
        await this.manejarSala(actualizada);
      } else {
        await this.reiniciarSala();
      }
    } catch (error) {
      this.mostrarError(error);
    }
  }

  private async reiniciarSala(): Promise<void> {
    if (!this.esAdmin || !this.sala) return;
    try {
      const actualizada = await this.servicios.admin.reiniciar(this.sala.id);
      await this.manejarSala(actualizada);
      this.mostrarToast('Sala reiniciada. Los jugadores pueden volver a entrar.');
    } catch (error) {
      this.mostrarError(error);
    }
  }

  private async ajustarDuracion(): Promise<void> {
    if (!this.esAdmin || !this.sala) return;
    const valor = Number(porId<HTMLSelectElement>('adminTimeSelect').value);
    if (this.sala.estado !== 'WAITING') {
      porId<HTMLSelectElement>('adminTimeSelect').value = String(this.sala.duracionSeg);
      this.mostrarToast('Solo se puede ajustar el tiempo en la sala de espera.');
      return;
    }
    try {
      await this.servicios.admin.ajustarDuracion(this.sala.id, valor);
      this.mostrarToast(`Tiempo por pregunta ajustado a ${valor}s`);
    } catch (error) {
      this.mostrarError(error);
    }
  }

  private async refrescarJugadores(): Promise<void> {
    const sala = this.sala;
    if (!sala) return;
    try {
      this.jugadores = await this.servicios.sala.listarJugadores(sala.id);
    } catch (error) {
      this.mostrarError(error);
      return;
    }
    if (this.jugador) {
      const actualizado = this.jugadores.find((item) => item.id === this.jugador?.id);
      if (!actualizado) {
        this.mostrarToast('El administrador te quitó de la sala.');
        this.volverAlInicio();
        return;
      }
      this.jugador = actualizado;
    }
    this.renderWaitingRoom();
    this.actualizarHud();
    await this.actualizarContadores();
    if (!porId('screenResultados').classList.contains('hidden')) this.renderTop10();
    if (!porId('screenPodio').classList.contains('hidden')) this.renderPodium();
    if (!porId('modalPlayerManager').classList.contains('hidden')) this.renderPlayerManager();
  }

  private async actualizarContadores(): Promise<void> {
    const total = this.jugadores.length;
    let respondidos = 0;
    if (
      this.sala &&
      this.sala.estado !== 'WAITING' &&
      this.sala.estado !== 'PODIUM' &&
      this.sala.rondaActual >= 0
    ) {
      try {
        respondidos = await this.servicios.juego.contar(this.sala.id, this.sala.rondaActual);
      } catch (error) {
        if (!(error instanceof ErrorDominio)) this.mostrarError(error);
      }
    }
    establecerTexto('adminBarPlayerCount', `${total}/50`);
    establecerTexto('adminManagePlayerCount', String(total));
    establecerTexto('hudActivePlayersCount', String(total));
    establecerTexto('hudAnsweredRatio', `${respondidos}/${total}`);
  }

  private renderWaitingRoom(): void {
    const sala = this.sala;
    if (!sala) return;
    establecerTexto('codigoSala', sala.codigo);
    establecerTexto('waitingRoomCount', `${this.jugadores.length} / 50`);
    const grid = porId('waitingPlayersGrid');
    limpiar(grid);
    if (this.jugadores.length === 0) {
      grid.appendChild(
        crear('span', 'py-4 text-xs text-slate-500', 'Aún no hay jugadores conectados en esta sala...')
      );
    } else {
      this.jugadores.forEach((jugador) => {
        const chip = crear(
          'div',
          'flex items-center gap-2 rounded-xl border border-night-700 bg-night-800 px-3.5 py-1.5 text-xs font-bold text-cream shadow sm:text-sm'
        );
        chip.appendChild(crear('span', 'h-2 w-2 rounded-full bg-mint-400'));
        chip.appendChild(crear('span', '', jugador.nombre));
        grid.appendChild(chip);
      });
    }
    mostrar(porId('waitingAdminActions'), this.esAdmin);
    mostrar(porId('waitingPlayerSpinner'), !this.esAdmin);
    establecerTexto(
      'waitingRoomStatusText',
      this.esAdmin
        ? 'Comparte el código. Presiona "Iniciar reto" cuando todos estén listos.'
        : 'Esperando a que el administrador inicie el reto...'
    );
    this.actualizarBotonAdmin();
  }

  private renderPlayerManager(): void {
    const contenedor = porId('playerManagerList');
    limpiar(contenedor);
    const ranking = ordenarRanking(this.jugadores);
    if (ranking.length === 0) {
      contenedor.appendChild(
        crear('div', 'text-center py-8 text-slate-500 text-sm', 'No hay jugadores conectados.')
      );
      return;
    }
    ranking.forEach((jugador) => {
      const fila = crear(
        'div',
        'flex items-center justify-between gap-3 rounded-xl border border-night-700 bg-night-950/80 px-3 py-2.5'
      );
      const info = crear('div', 'flex min-w-0 items-center gap-2.5');
      info.appendChild(
        crear(
          'span',
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint-500 font-arcade text-sm text-night-950',
          jugador.nombre.charAt(0).toUpperCase()
        )
      );
      const datos = crear('div', 'min-w-0');
      datos.appendChild(crear('p', 'truncate text-sm font-bold text-cream', jugador.nombre));
      datos.appendChild(crear('p', 'text-[11px] text-slate-400', `${jugador.puntaje} pts`));
      info.appendChild(datos);
      const boton = crear(
        'button',
        'shrink-0 rounded-lg bg-coral-500 px-3 py-1.5 text-xs font-bold text-night-950 transition hover:bg-coral-400',
        'Quitar'
      );
      boton.type = 'button';
      boton.addEventListener('click', () => {
        void this.expulsarJugador(jugador);
      });
      fila.append(info, boton);
      contenedor.appendChild(fila);
    });
  }

  private async expulsarJugador(jugador: Jugador): Promise<void> {
    if (!this.esAdmin || !this.sala) return;
    try {
      await this.servicios.admin.expulsar(this.sala.id, jugador.id);
      await this.refrescarJugadores();
      this.mostrarToast(`${jugador.nombre} fue eliminado de la sala.`);
    } catch (error) {
      this.mostrarError(error);
    }
  }

  private async abrirEditor(): Promise<void> {
    if (!this.esAdmin || !this.sala) return;
    if (this.sala.estado !== 'WAITING') {
      this.mostrarToast('Solo se pueden editar las preguntas en la sala de espera.');
      return;
    }
    await this.refrescarPreguntasAdmin();
    if (this.preguntasAdmin.length !== TOTAL_PREGUNTAS) {
      this.mostrarToast('No se pudieron cargar las 5 preguntas.');
      return;
    }
    this.editorTab = 0;
    this.renderEditorTabs();
    this.poblarEditor();
    this.limpiarError('editorError');
    mostrarModal(porId('modalQuestionEditor'), true);
  }

  private async refrescarPreguntasAdmin(): Promise<void> {
    if (!this.esAdmin || !this.sala) return;
    try {
      this.preguntasAdmin = await this.servicios.admin.obtenerPreguntas(this.sala.id);
    } catch (error) {
      this.mostrarError(error);
    }
  }

  private renderEditorTabs(): void {
    const contenedor = porId('editorTabsContainer');
    limpiar(contenedor);
    this.preguntasAdmin.forEach((_pregunta, indice) => {
      const boton = crear(
        'button',
        `rounded-t-xl px-3.5 py-2 text-xs font-bold transition ${
          indice === this.editorTab
            ? 'bg-sun-400 text-night-950'
            : 'bg-night-800 text-slate-300 hover:bg-night-700'
        }`,
        `Reto ${indice + 1}`
      );
      boton.type = 'button';
      boton.addEventListener('click', () => {
        this.guardarPestanaActual();
        this.editorTab = indice;
        this.renderEditorTabs();
        this.poblarEditor();
      });
      contenedor.appendChild(boton);
    });
  }

  private poblarEditor(): void {
    const pregunta = this.preguntasAdmin[this.editorTab];
    if (!pregunta) return;
    establecerTexto('editorGameLabel', pregunta.titulo);
    porId<HTMLTextAreaElement>('editorQuestionInput').value = pregunta.texto;
    for (let indice = 0; indice < 4; indice++) {
      porId<HTMLInputElement>(`editorOpt${indice}`).value = pregunta.opciones[indice] ?? '';
    }
    document.querySelectorAll<HTMLInputElement>('input[name="editorCorrectOption"]').forEach((radio) => {
      radio.checked = Number(radio.value) === pregunta.indiceCorrecto;
    });
  }

  private guardarPestanaActual(): void {
    const pregunta = this.preguntasAdmin[this.editorTab];
    if (!pregunta) return;
    const texto = porId<HTMLTextAreaElement>('editorQuestionInput').value.trim();
    if (texto) pregunta.texto = texto;
    for (let indice = 0; indice < 4; indice++) {
      const valor = porId<HTMLInputElement>(`editorOpt${indice}`).value.trim();
      if (valor) pregunta.opciones[indice] = valor;
    }
    const seleccionada = document.querySelector<HTMLInputElement>(
      'input[name="editorCorrectOption"]:checked'
    );
    if (seleccionada) pregunta.indiceCorrecto = Number(seleccionada.value);
  }

  private async guardarEditor(): Promise<void> {
    if (!this.esAdmin || !this.sala) return;
    this.limpiarError('editorError');
    this.guardarPestanaActual();
    const preguntas: PreguntaEditable[] = this.preguntasAdmin.map((pregunta) => ({
      posicion: pregunta.posicion,
      tipoMinijuego: pregunta.tipoMinijuego,
      titulo: pregunta.titulo,
      texto: pregunta.texto,
      opciones: [...pregunta.opciones],
      indiceCorrecto: pregunta.indiceCorrecto
    }));
    try {
      await this.servicios.admin.guardarPreguntas(this.sala.id, preguntas);
      mostrarModal(porId('modalQuestionEditor'), false);
      this.mostrarToast('Preguntas guardadas correctamente.');
      await this.refrescarPreguntasAdmin();
    } catch (error) {
      this.mostrarErrorFormulario('editorError', error);
    }
  }

  private actualizarBotonAdmin(): void {
    if (!this.esAdmin) return;
    const sala = this.sala;
    if (!sala) return;
    const etiqueta =
      sala.estado === 'WAITING'
        ? 'Iniciar reto'
        : sala.estado === 'IN_GAME'
          ? 'Evaluar reto ahora'
          : sala.estado === 'REVEALED'
            ? sala.rondaActual >= TOTAL_PREGUNTAS - 1
              ? 'Ver podio final'
              : 'Siguiente reto'
            : 'Jugar de nuevo';
    establecerTexto('btnAdminNextLabel', etiqueta);
    establecerTexto('btnIntermissionNextText', etiqueta);
    porId<HTMLSelectElement>('adminTimeSelect').disabled = sala.estado !== 'WAITING';
    porId<HTMLButtonElement>('btnOpenQuestionEditor').disabled = sala.estado !== 'WAITING';
  }

  private actualizarCodigoSala(): void {
    const sala = this.sala;
    if (!sala) return;
    establecerTexto('adminSalaCodigo', sala.codigo);
    establecerTexto('codigoSala', sala.codigo);
    porId<HTMLSelectElement>('adminTimeSelect').value = String(sala.duracionSeg);
  }

  private actualizarBarras(): void {
    const conSala = Boolean(this.sala);
    const enJuego = this.sala?.estado === 'IN_GAME' || this.sala?.estado === 'REVEALED';
    mostrar(porId('adminControlBar'), this.esAdmin && conSala);
    mostrar(porId('playerHudBar'), Boolean(this.jugador) && enJuego);
    mostrar(porId('btnLogout'), Boolean(this.sesionUsuarioId));
    porId('btnLogout').classList.add('flex');
    if (this.sala) {
      porId<HTMLSelectElement>('adminTimeSelect').value = String(this.sala.duracionSeg);
    }
  }

  private actualizarHud(): void {
    const jugador = this.jugador;
    if (!jugador) return;
    establecerTexto('hudPlayerName', jugador.nombre);
    establecerTexto('hudAvatar', jugador.nombre.charAt(0).toUpperCase());
    establecerTexto('hudUserId', jugador.id.slice(0, 8));
    establecerTexto('hudScoreValue', String(jugador.puntaje));
  }

  private actualizarChip(texto: string, color: 'verde' | 'ambar' | 'indigo' | 'azul'): void {
    const chip = porId('roundStatusChip');
    const colores: Record<typeof color, string> = {
      verde: 'border-mint-400/30 bg-mint-500/15 text-mint-300',
      ambar: 'border-sun-400/40 bg-sun-400/15 text-sun-300',
      indigo: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
      azul: 'border-sky-400/40 bg-sky-500/15 text-sky-300'
    };
    chip.textContent = texto;
    chip.className = `rounded-full border px-2.5 py-0.5 text-xs font-bold ${colores[color]}`;
  }

  private mostrarSolo(id: string): void {
    [
      'screenInicio',
      'screenAdminLogin',
      'screenAdminPanel',
      'screenEspera',
      'screenJuego',
      'screenResultados',
      'screenPodio'
    ].forEach((seccion) => mostrar(porId(seccion), seccion === id));
  }

  private mostrarInicio(): void {
    this.detenerMinijuego();
    this.detenerTemporizador();
    this.unsubscribeSala?.();
    this.unsubscribeSala = null;
    this.sala = null;
    this.jugador = null;
    this.jugadores = [];
    this.esAdmin = false;
    this.gameStarted = false;
    this.rondaCargada = -1;
    this.rondaEvaluada = false;
    this.preguntaActual = null;
    this.miRespuesta = null;
    this.podioMostrado = false;
    this.mostrarSolo('screenInicio');
    mostrar(porId('adminControlBar'), false);
    mostrar(porId('playerHudBar'), false);
    mostrar(porId('formJugador'), true);
    mostrar(porId('btnLogout'), Boolean(this.sesionUsuarioId));
    porId('btnLogout').classList.add('flex');
    const codigo = this.codigoUrl();
    if (codigo) porId<HTMLInputElement>('inputCodigoSala').value = codigo;
  }

  private volverAlInicio(): void {
    localStorage.removeItem('pq_sala_id');
    localStorage.removeItem('pq_codigo');
    localStorage.removeItem('pq_sala_codigo');
    this.mostrarInicio();
  }

  private async salir(): Promise<void> {
    try {
      if (this.jugador && this.sala) await this.servicios.sala.salir(this.sala.id);
      await this.servicios.sesion.salir();
    } catch (error) {
      this.mostrarError(error);
    } finally {
      localStorage.removeItem('pq_nombre');
      localStorage.removeItem('pq_codigo');
      localStorage.removeItem('pq_sala_id');
      localStorage.removeItem('pq_sala_codigo');
      window.location.reload();
    }
  }

  private async copiarEnlace(): Promise<void> {
    if (!this.sala) return;
    const enlace = `${window.location.origin}${window.location.pathname}?sala=${this.sala.codigo}`;
    try {
      await navigator.clipboard.writeText(enlace);
      this.mostrarToast('Enlace copiado al portapapeles.');
    } catch (error) {
      this.mostrarError(error);
    }
  }

  private alternarSonido(): void {
    const silenciado = this.sound.toggleMute();
    porId('iconSound').className = silenciado
      ? 'ph-fill ph-speaker-slash text-lg text-coral-400'
      : 'ph-fill ph-speaker-high text-lg';
    this.mostrarToast(silenciado ? 'Audio silenciado' : 'Efectos de sonido activados');
  }

  private guardarIdentidadJugador(nombre: string, codigo: string): void {
    localStorage.setItem('pq_nombre', nombre);
    localStorage.setItem('pq_codigo', codigo.toUpperCase());
  }

  private codigoUrl(): string | null {
    const codigo = new URLSearchParams(window.location.search).get('sala');
    return codigo ? codigo.trim().toUpperCase() : null;
  }

  private detenerTemporizador(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private detenerMinijuego(): void {
    this.detenerTemporizador();
    this.juego1?.stop();
    this.juegoCanvas?.stop();
    this.juego1 = null;
    this.juegoCanvas = null;
    this.juegoCintas = null;
    this.juegoCanon = null;
    mostrar(porId('btnRestoreShot'), false);
  }

  private requerirSala(): Sala {
    if (!this.sala) throw new ErrorDominio('SALA_NO_EXISTE', 'No hay una sala activa.');
    return this.sala;
  }

  private actualizarConexion(conectado: boolean, texto: string): void {
    const punto = porId('dbStatusDot');
    punto.className = conectado
      ? 'h-2 w-2 rounded-full bg-mint-400 shadow-[0_0_8px_#5fd0b0]'
      : 'h-2 w-2 rounded-full bg-coral-400';
    establecerTexto('dbStatusText', texto);
  }

  private mostrarError(error: unknown): void {
    if (error instanceof ErrorDominio) {
      this.mostrarToast(error.message);
      return;
    }
    this.mostrarToast('No se pudo completar la operación. Intenta de nuevo.');
  }

  private mostrarErrorFormulario(id: string, error: unknown): void {
    const elemento = porId(id);
    elemento.textContent =
      error instanceof ErrorDominio
        ? error.message
        : 'No se pudo completar la operación. Intenta de nuevo.';
    mostrar(elemento, true);
  }

  private limpiarError(id: string): void {
    const elemento = porId(id);
    elemento.textContent = '';
    mostrar(elemento, false);
  }

  private mostrarToast(mensaje: string): void {
    const toast = porId('toastNotification');
    establecerTexto('toastMessage', mensaje);
    toast.classList.remove('opacity-0', 'translate-y-4');
    if (this.toastTimeout !== null) window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
    }, 2800);
  }

  private deshabilitar(id: string, deshabilitado: boolean): void {
    porId<HTMLButtonElement>(id).disabled = deshabilitado;
  }
}
