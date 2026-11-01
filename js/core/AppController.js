import { SoundFX } from '../audio/SoundFX.js';
import { ScoreSystem } from '../scoring/ScoreSystem.js';
import { QuizDataManager } from '../data/QuizDataManager.js';
import { SyncManager } from '../sync/SyncManager.js';
import { SessionStore } from '../storage/SessionStore.js';
import { MiniGame1_Kahoot } from '../minigames/MiniGame1_Kahoot.js';
import { MiniGame2_Platformer } from '../minigames/MiniGame2_Platformer.js';
import { MiniGame3_SpaceDoors } from '../minigames/MiniGame3_SpaceDoors.js';
import { MiniGame4_Conveyor } from '../minigames/MiniGame4_Conveyor.js';
import { MiniGame5_Cannon } from '../minigames/MiniGame5_Cannon.js';

/**
 * =========================================================================
 * AppController (Controlador Principal de la SPA y Orquestador)
 * Gestiona login simple, sala de espera (máx 50), rol AdminEdisonGameQuiz,
 * pantalla intermedia con Top 10 entre juegos y Podio Final.
 * =========================================================================
 */
export class AppController {
  constructor() {
    this.ADMIN_SECRET_NAME = 'AdminEdisonGameQuiz';

    this.sessionStore = new SessionStore();
    this.sound = new SoundFX();
    this.scoreSystem = new ScoreSystem();
    this.quizData = new QuizDataManager();

    this.player = {
      id: '',
      name: '',
      isAdmin: false
    };

    this.loggedIn = false;
    this.kicked = false;
    this.gameStarted = false;
    this.currentRound = 0; // 0 a 4 (5 Mini-Juegos)
    this.roundDurationSec = 30;
    this.timeLeftSec = 30;
    this.roundStartTime = 0;
    this.selectedAnswerIndex = null;
    this.hasAnsweredCurrentRound = false;
    this.roundEvaluated = false;
    this.lastHandledActionId = 0;
    this.currentSessionId = 1;
    this.timerInterval = null;
    this.editorActiveTab = 0;

    this.sync = new SyncManager(
      {
        onConnectionChange: (isOnline, label) => this.updateConnectionBadge(isOnline, label),
        onSessionState: (state) => this.handleRemoteSessionState(state),
        onQuestionsUpdated: (questions) => this.handleRemoteQuestions(questions),
        onPlayersUpdated: () => this.handleRemotePlayersUpdated(),
        onPlayerRemoved: (playerId) => this.handlePlayerRemoved(playerId)
      },
      { sessionStore: this.sessionStore }
    );
    this.player.id = this.sync.userId;

    this.initMiniGames();
    this.bindEvents();
    this.startAnimationLoop();
    this.initGlobalConnection();
  }

  async initGlobalConnection() {
    await this.sync.init();
    this.player.id = this.sync.userId;
    const hudUserIdEl = document.getElementById('hudUserId');
    if (hudUserIdEl) hudUserIdEl.textContent = this.player.id;

    // Si había una sesión guardada, entra automáticamente sin pedir el nombre
    const savedName = this.sessionStore.getPlayerName();
    if (savedName && !this.loggedIn) {
      const inputName = document.getElementById('inputPlayerName');
      if (inputName) inputName.value = savedName;
      await this.login(savedName, { restoring: true });
    }
  }

  updateConnectionBadge(isOnline, label) {
    const dot = document.getElementById('dbStatusDot');
    const txt = document.getElementById('dbStatusText');
    if (!dot || !txt) return;
    dot.className = isOnline
      ? 'w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]'
      : 'w-2 h-2 rounded-full bg-rose-400';
    txt.textContent = label;
  }

  initMiniGames() {
    const containerGame1 = document.getElementById('containerGame1');
    const canvas = document.getElementById('gameCanvas');
    const btnRestoreShot = document.getElementById('btnRestoreShot');

    this.game1 = new MiniGame1_Kahoot(
      containerGame1,
      (idx, locked) => this.onPlayerSelectOption(idx, locked),
      this.sound
    );
    this.game2 = new MiniGame2_Platformer(canvas, (idx, locked) => this.onPlayerSelectOption(idx, locked), this.sound);
    this.game3 = new MiniGame3_SpaceDoors(canvas, (idx, locked) => this.onPlayerSelectOption(idx, locked), this.sound);
    this.game4 = new MiniGame4_Conveyor(canvas, (idx, locked) => this.onPlayerSelectOption(idx, locked), this.sound);
    this.game5 = new MiniGame5_Cannon(
      canvas,
      (idx, locked) => this.onPlayerSelectOption(idx, locked),
      this.sound,
      (isLocked) => {
        if (isLocked && !this.roundEvaluated) {
          btnRestoreShot.classList.remove('hidden');
          btnRestoreShot.classList.add('flex');
        } else {
          btnRestoreShot.classList.add('hidden');
          btnRestoreShot.classList.remove('flex');
        }
      }
    );

    this.activeCanvasGame = null;

    window.addEventListener('resize', () => {
      if (this.activeCanvasGame) this.activeCanvasGame.resize();
    });
  }

  bindEvents() {
    // Login Form Simple
    const loginForm = document.getElementById('loginForm');
    const inputName = document.getElementById('inputPlayerName');

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = inputName.value.trim();
      if (!rawName) return;
      this.login(rawName);
    });

    // Botón Sonido
    document.getElementById('btnToggleMute').addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      const icon = document.getElementById('iconSound');
      icon.className = muted ? 'ph-fill ph-speaker-slash text-lg text-rose-400' : 'ph-fill ph-speaker-high text-lg';
      this.showToast(muted ? 'Audio silenciado' : 'Efectos de sonido activados');
    });

    // Cambiar de jugador / cerrar la sesión guardada
    document.getElementById('btnLogout').addEventListener('click', () => {
      this.logout();
    });

    // Controles exclusivos del Administrador
    document.getElementById('adminTimeSelect').addEventListener('change', async (e) => {
      if (!this.player.isAdmin) return;
      this.roundDurationSec = parseInt(e.target.value, 10) || 30;
      await this.sync.setSessionState({ duration: this.roundDurationSec });
      this.showToast(`Tiempo por pregunta ajustado a ${this.roundDurationSec}s`);
    });

    document.getElementById('btnLobbyStartQuiz').addEventListener('click', () => {
      if (!this.player.isAdmin) return;
      this.adminStartQuiz();
    });

    document.getElementById('btnLobbyEditQuestions').addEventListener('click', () => {
      if (!this.player.isAdmin) return;
      this.openQuestionEditor(0);
    });

    document.getElementById('btnAdminNext').addEventListener('click', () => {
      if (!this.player.isAdmin) return;
      this.handleAdminAdvanceAction();
    });

    document.getElementById('btnIntermissionNextAdmin').addEventListener('click', () => {
      if (!this.player.isAdmin) return;
      this.handleAdminAdvanceAction();
    });

    // Gestión de jugadores (solo Admin)
    document.getElementById('btnManagePlayers').addEventListener('click', () => {
      if (!this.player.isAdmin) return;
      this.openPlayerManager();
    });
    document.getElementById('btnClosePlayerManager').addEventListener('click', () => {
      document.getElementById('modalPlayerManager').classList.add('hidden');
    });
    document.getElementById('modalPlayerManager').addEventListener('click', (e) => {
      if (e.target.id === 'modalPlayerManager') {
        document.getElementById('modalPlayerManager').classList.add('hidden');
      }
    });

    // Botón Restaurar Selección en el Juego 5 (Cañón)
    document.getElementById('btnRestoreShot').addEventListener('click', () => {
      if (this.currentRound === 4 && !this.roundEvaluated) {
        this.game5.restoreSelection();
        this.showToast('Disparo restaurado. ¡Apunta y dispara de nuevo!');
      }
    });

    // Editor de Preguntas (Modal exclusivo Admin)
    document.getElementById('btnOpenQuestionEditor').addEventListener('click', () => {
      if (!this.player.isAdmin) return;
      this.openQuestionEditor(this.currentRound < 5 ? this.currentRound : 0);
    });
    document.getElementById('btnCloseEditorModal').addEventListener('click', () => {
      this.saveCurrentTabToMemory();
      document.getElementById('modalQuestionEditor').classList.add('hidden');
    });
    document.getElementById('btnSaveQuestions').addEventListener('click', async () => {
      if (!this.player.isAdmin) return;
      this.saveCurrentTabToMemory();
      await this.sync.saveGlobalQuestions(this.quizData.questions);
      document.getElementById('modalQuestionEditor').classList.add('hidden');
      if (this.gameStarted && this.currentRound < 5 && !this.roundEvaluated) {
        this.loadRound(this.currentRound);
      }
      this.showToast('¡Preguntas guardadas globalmente para todos los jugadores!');
    });

    // Controles de Teclado para los Mini-Juegos Canvas
    window.addEventListener('keydown', (e) => {
      if (!this.activeCanvasGame) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.activeCanvasGame.setInput('left', true);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.activeCanvasGame.setInput('right', true);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (document.activeElement.tagName !== 'INPUT') {
          e.preventDefault();
          if (this.currentRound === 2) {
            this.activeCanvasGame.setInput('up', true);
          } else {
            this.activeCanvasGame.setInput('action', true);
          }
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        if (document.activeElement.tagName !== 'INPUT' && this.currentRound === 2) {
          e.preventDefault();
          this.activeCanvasGame.setInput('down', true);
        }
      } else if (e.key === ' ') {
        if (document.activeElement.tagName !== 'INPUT') {
          e.preventDefault();
          this.activeCanvasGame.setInput('action', true);
        }
      } else if (['1', '2', '3', '4'].includes(e.key) && this.currentRound === 3) {
        this.game4.selectLane(parseInt(e.key, 10) - 1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.activeCanvasGame) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.activeCanvasGame.setInput('left', false);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.activeCanvasGame.setInput('right', false);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.activeCanvasGame.setInput('up', false);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.activeCanvasGame.setInput('down', false);
      }
    });

    // Controles táctiles / botones en pantalla
    const bindHoldBtn = (id, dir) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.activeCanvasGame) this.activeCanvasGame.setInput(dir, true);
      });
      btn.addEventListener('pointerup', () => {
        if (this.activeCanvasGame) this.activeCanvasGame.setInput(dir, false);
      });
      btn.addEventListener('pointerleave', () => {
        if (this.activeCanvasGame) this.activeCanvasGame.setInput(dir, false);
      });
    };

    bindHoldBtn('btnTouchLeft', 'left');
    bindHoldBtn('btnTouchRight', 'right');
    bindHoldBtn('btnTouchUp', 'up');
    bindHoldBtn('btnTouchDown', 'down');

    document.getElementById('btnTouchAction').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.activeCanvasGame) this.activeCanvasGame.setInput('action', true);
    });

    // Botones de carril 1-4 para Juego 4
    document.querySelectorAll('.lane-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lane = parseInt(btn.dataset.lane, 10);
        this.game4.selectLane(lane);
      });
    });

    // Botón del Podio Final (Exclusivo Admin)
    document.getElementById('btnPlayAgain').addEventListener('click', async () => {
      if (!this.player.isAdmin) return;
      const nextSessionId = (this.sync.getSessionState().sessionId || 1) + 1;
      await this.sync.setSessionState({
        status: 'WAITING',
        currentRound: 0,
        sessionId: nextSessionId,
        roundActionId: Date.now()
      });
      this.restartToWaitingRoom();
    });
  }

  /**
   * Ingreso a la plataforma:
   * - Si es AdminEdisonGameQuiz, muestra los controles de Admin.
   * - Si es jugador normal, verifica el cupo máximo de 50 personas y lo lleva a la Sala de Espera.
   */
  async login(name, { restoring = false } = {}) {
    this.sound.init();
    name = String(name || '').trim();
    if (!name) return false;

    const isAdminKey = name === this.ADMIN_SECRET_NAME;
    const loginErr = document.getElementById('loginErrorMsg');
    loginErr.classList.add('hidden');

    if (!isAdminKey) {
      const currentPlayers = this.sync.getAllPlayers();
      const normalizedName = name.toLowerCase();
      const nameTaken = currentPlayers.some(
        (p) => p.id !== this.player.id && String(p.name || '').trim().toLowerCase() === normalizedName
      );

      if (nameTaken) {
        loginErr.textContent = `El nombre "${name}" ya está siendo usado por otro jugador en esta sala. Elige otro.`;
        loginErr.classList.remove('hidden');
        this.sound.wrong();
        return false;
      }

      const alreadyExists = currentPlayers.some((p) => p.id === this.player.id);
      if (!alreadyExists && currentPlayers.length >= this.sync.MAX_PLAYERS) {
        loginErr.textContent = 'La sala de espera ha alcanzado su capacidad máxima (50 jugadores).';
        loginErr.classList.remove('hidden');
        this.sound.wrong();
        return false;
      }
    }

    if (!restoring) this.sound.select();
    this.player.name = name;
    this.player.isAdmin = isAdminKey;
    this.loggedIn = true;
    this.kicked = false;

    // Recordar la identidad para restaurarla tras un refresco
    this.sessionStore.savePlayerName(name);
    const logoutBtn = document.getElementById('btnLogout');
    logoutBtn.classList.remove('hidden');
    logoutBtn.classList.add('flex');

    // Actualizar HUD
    document.getElementById('hudPlayerName').textContent = name;
    document.getElementById('hudAvatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('hudUserId').textContent = this.player.id;
    const roleTag = document.getElementById('hudRoleTag');

    const adminBar = document.getElementById('adminControlBar');
    const waitingAdminActions = document.getElementById('waitingAdminActions');
    const waitingSpinner = document.getElementById('waitingPlayerSpinner');
    const waitingStatusText = document.getElementById('waitingRoomStatusText');

    if (isAdminKey) {
      roleTag.textContent = 'ADMIN';
      roleTag.className = 'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400/40 font-bold';
      adminBar.classList.remove('hidden');
      waitingAdminActions.classList.remove('hidden');
      waitingSpinner.classList.add('hidden');

      if (restoring) {
        waitingStatusText.textContent = 'Sesión restaurada. Continúa la partida donde se quedó.';
      } else {
        waitingStatusText.textContent = 'Panel de Sala de Espera. Presiona "Iniciar Quiz Ahora" cuando los jugadores estén listos. Usa "Jugadores" para quitar a alguien.';
        // Solo un login manual reinicia la sala; un refresco no debe borrar la partida
        await this.sync.setSessionState({
          status: 'WAITING',
          currentRound: 0,
          duration: this.roundDurationSec,
          roundActionId: Date.now()
        });
      }
    } else {
      roleTag.textContent = 'JUGADOR';
      roleTag.className = 'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-400/30 font-semibold';
      // Usuario normal NO ve nada del admin
      adminBar.classList.add('hidden');
      waitingAdminActions.classList.add('hidden');
      waitingSpinner.classList.remove('hidden');
      waitingStatusText.textContent = 'Esperando a que el Administrador inicie el quiz...';
    }

    if (restoring) {
      this.restoreProgressState();
    } else {
      this.scoreSystem.reset();
      this.sessionStore.clearProgress();
    }
    this.updateHudScoreAndStreak();
    await this.syncPlayerState();

    // Mostrar Sala de Espera
    document.getElementById('screenLogin').classList.add('hidden');
    document.getElementById('screenWaitingRoom').classList.remove('hidden');
    this.renderWaitingRoomUI();

    // Reengancharse a la partida activa (jugador nuevo o cualquier usuario que refrescó)
    const sessionState = this.sync.getSessionState();
    if (restoring || !isAdminKey) {
      if (sessionState.status === 'IN_GAME') {
        this.roundDurationSec = sessionState.duration || this.roundDurationSec;
        this.lastHandledActionId = sessionState.roundActionId || 0;
        this.startQuizSession(sessionState.currentRound || 0);
      } else if (sessionState.status === 'REVEALED') {
        this.roundDurationSec = sessionState.duration || this.roundDurationSec;
        this.lastHandledActionId = sessionState.roundActionId || 0;
        this.startQuizSession(sessionState.currentRound || 0);
        this.triggerTimeZeroSequence();
      } else if (sessionState.status === 'PODIUM') {
        this.showFinalPodium();
      }
    }
    return true;
  }

  restoreProgressState() {
    const saved = this.sessionStore.getProgress();
    if (!saved) return;

    const sessionState = this.sync.getSessionState();
    if ((saved.sessionId || 1) !== (sessionState.sessionId || 1)) return;

    this.scoreSystem.score = Number(saved.score) || 0;
    this.scoreSystem.streak = Number(saved.streak) || 0;
    this.scoreSystem.maxStreak = Number(saved.maxStreak) || 0;
  }

  saveProgressState() {
    if (!this.loggedIn || this.player.isAdmin || !this.gameStarted) return;
    const sessionState = this.sync.getSessionState();
    this.sessionStore.saveProgress({
      sessionId: sessionState.sessionId || 1,
      round: this.currentRound,
      score: this.scoreSystem.score,
      streak: this.scoreSystem.streak,
      maxStreak: this.scoreSystem.maxStreak
    });
  }

  async logout() {
    this.sessionStore.clearIdentity();
    this.sessionStore.clearProgress();
    document.getElementById('btnLogout').classList.add('hidden');
    document.getElementById('btnLogout').classList.remove('flex');
    if (this.player.id) await this.sync.removePlayer(this.player.id);
    window.location.reload();
  }

  openPlayerManager() {
    if (!this.player.isAdmin) return;
    this.renderPlayerManager();
    document.getElementById('modalPlayerManager').classList.remove('hidden');
  }

  renderPlayerManager() {
    const container = document.getElementById('playerManagerList');
    if (!container) return;

    const players = this.sync
      .getAllPlayers()
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.name).localeCompare(String(b.name)));

    if (players.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-500">
          <i class="ph ph-users text-4xl mb-2"></i>
          <p class="text-sm">No hay jugadores conectados en esta sala.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = players
      .map((p) => {
        const safeId = this.escapeHtml(p.id);
        const safeName = this.escapeHtml(p.name);
        const initial = this.escapeHtml(String(p.name || '?').charAt(0).toUpperCase());
        return `
          <div class="flex items-center justify-between gap-3 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-arcade text-sm text-white shrink-0">${initial}</span>
              <div class="min-w-0">
                <p class="font-bold text-white text-sm truncate">${safeName}</p>
                <p class="text-[11px] text-slate-400">${Number(p.score) || 0} pts · Racha x${Number(p.streak) || 0}</p>
              </div>
            </div>
            <button type="button" data-remove-player="${safeId}" class="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 transition">
              <i class="ph-bold ph-user-minus"></i>
              <span>Quitar</span>
            </button>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('[data-remove-player]').forEach((btn) => {
      btn.addEventListener('click', () => this.removePlayerFromRoom(btn.dataset.removePlayer));
    });
  }

  async removePlayerFromRoom(playerId) {
    if (!this.player.isAdmin) return;
    const target = this.sync.getAllPlayers().find((p) => p.id === playerId);
    await this.sync.removePlayer(playerId);
    this.renderPlayerManager();
    this.renderWaitingRoomUI();
    this.showToast(`${target?.name || 'Jugador'} fue eliminado de la sala`);
  }

  handlePlayerRemoved(playerId) {
    if (!this.loggedIn || this.player.isAdmin || !this.player.id) return;
    if (playerId !== this.player.id) return;

    this.kicked = true;
    this.loggedIn = false;
    this.sessionStore.clearIdentity();
    this.sessionStore.clearProgress();
    this.showToast('El administrador te ha quitado de la sala. Volviendo al ingreso...');
    setTimeout(() => window.location.reload(), 1600);
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  renderWaitingRoomUI() {
    const players = this.sync.getAllPlayers();
    const countText = `${players.length} / ${this.sync.MAX_PLAYERS}`;
    document.getElementById('waitingRoomCount').textContent = countText;
    document.getElementById('adminBarPlayerCount').textContent = countText;

    const grid = document.getElementById('waitingPlayersGrid');
    if (players.length === 0) {
      grid.innerHTML = `<span class="text-xs text-slate-500 py-4">Aún no hay jugadores conectados en la sala...</span>`;
    } else {
      grid.innerHTML = players
        .map(
          (p) => `
          <div class="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-xs sm:text-sm font-bold text-white flex items-center gap-2 shadow">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>${p.name}</span>
          </div>
        `
        )
        .join('');
    }
    this.updateLiveCountersUI();
  }

  /**
   * Actualiza el contador de jugadores actuales y cuántos ya respondieron (ej. 10/20)
   */
  updateLiveCountersUI() {
    const players = this.sync.getAllPlayers();
    const totalPlayers = players.length;
    const answeredCount = players.filter((p) => p.answeredRound === this.currentRound && p.hasAnswered).length;

    document.getElementById('adminBarPlayerCount').textContent = `${totalPlayers}/${this.sync.MAX_PLAYERS}`;
    const manageCount = document.getElementById('adminManagePlayerCount');
    if (manageCount) manageCount.textContent = String(totalPlayers);
    document.getElementById('hudActivePlayersCount').textContent = `${totalPlayers}`;
    document.getElementById('hudAnsweredRatio').textContent = `${answeredCount}/${totalPlayers}`;
  }

  async adminStartQuiz() {
    const actionId = Date.now();
    this.lastHandledActionId = actionId;
    await this.sync.setSessionState({
      status: 'IN_GAME',
      currentRound: 0,
      duration: this.roundDurationSec,
      roundActionId: actionId
    });
    this.startQuizSession(0);
  }

  startQuizSession(startRound = 0) {
    this.gameStarted = true;
    document.getElementById('screenWaitingRoom').classList.add('hidden');
    document.getElementById('screenRoundResults').classList.add('hidden');
    document.getElementById('screenPodium').classList.add('hidden');
    document.getElementById('playerHudBar').classList.remove('hidden');
    document.getElementById('screenGame').classList.remove('hidden');
    this.loadRound(startRound);
  }

  async handleAdminAdvanceAction() {
    if (!this.gameStarted) {
      await this.adminStartQuiz();
      return;
    }
    if (!this.roundEvaluated) {
      // Si la ronda sigue corriendo, el Admin puede finalizar el tiempo y evaluar para todos
      const actionId = Date.now();
      this.lastHandledActionId = actionId;
      await this.sync.setSessionState({
        status: 'REVEALED',
        currentRound: this.currentRound,
        roundActionId: actionId
      });
      this.triggerTimeZeroSequence();
      return;
    }
    // Si ya estamos viendo los resultados de la ronda + Top 10, avanzar al siguiente juego
    await this.advanceToNextRound();
  }

  /**
   * Carga una de las 5 rondas (0 a 4)
   */
  loadRound(roundIdx) {
    this.currentRound = roundIdx;
    this.roundEvaluated = false;
    this.selectedAnswerIndex = null;
    this.hasAnsweredCurrentRound = false;

    if (this.activeCanvasGame) {
      this.activeCanvasGame.stop();
      this.activeCanvasGame = null;
    }

    document.getElementById('screenRoundResults').classList.add('hidden');
    document.getElementById('screenGame').classList.remove('hidden');

    const qObj = this.quizData.questions[roundIdx];
    const gameIcons = [
      'ph-squares-four',
      'ph-person-simple-run',
      'ph-rocket-launch',
      'ph-conveyor-belt',
      'ph-target'
    ];

    // Actualizar Cabecera
    document.getElementById('hudGameTitle').textContent = qObj.gameTitle;
    document.getElementById('badgeRoundNumber').textContent = `RONDA ${roundIdx + 1}/5`;
    document.getElementById('badgeMiniGameType').innerHTML = `<i class="ph-fill ${gameIcons[roundIdx]}"></i> ${qObj.gameTitle}`;
    document.getElementById('questionHeading').textContent = qObj.question;

    const statusChip = document.getElementById('roundStatusChip');
    statusChip.textContent = 'En curso - ¡Selecciona tu respuesta!';
    statusChip.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';

    document.getElementById('btnAdminNextLabel').textContent = 'Evaluar Ronda Ahora';

    // Configurar vista DOM (Juego 1) vs Canvas 2D (Juegos 2, 3, 4, 5)
    const containerGame1 = document.getElementById('containerGame1');
    const containerCanvas = document.getElementById('containerCanvasGames');
    const laneQuickBtns = document.getElementById('laneQuickButtons');
    const btnTouchAction = document.getElementById('btnTouchAction');
    const actionBtnText = document.getElementById('btnTouchActionText');
    const btnTouchUp = document.getElementById('btnTouchUp');
    const btnTouchDown = document.getElementById('btnTouchDown');
    const btnRestoreShot = document.getElementById('btnRestoreShot');
    const topHint = document.getElementById('canvasTopHint');

    btnTouchUp.classList.add('hidden');
    btnTouchUp.classList.remove('flex');
    btnTouchDown.classList.add('hidden');
    btnTouchDown.classList.remove('flex');
    btnRestoreShot.classList.add('hidden');
    btnRestoreShot.classList.remove('flex');
    btnTouchAction.classList.remove('hidden');

    if (roundIdx === 0) {
      containerGame1.classList.remove('hidden');
      containerCanvas.classList.add('hidden');
      this.game1.start(qObj);
    } else {
      containerGame1.classList.add('hidden');
      containerCanvas.classList.remove('hidden');
      laneQuickBtns.classList.add('hidden');

      if (roundIdx === 1) {
        this.activeCanvasGame = this.game2;
        actionBtnText.textContent = 'SALTAR (ESPACIO / ↑)';
        topHint.textContent = '🏃 Salta y quédate sobre la plataforma con la respuesta correcta';
      } else if (roundIdx === 2) {
        this.activeCanvasGame = this.game3;
        btnTouchUp.classList.remove('hidden');
        btnTouchUp.classList.add('flex');
        btnTouchDown.classList.remove('hidden');
        btnTouchDown.classList.add('flex');
        btnTouchAction.classList.add('hidden');
        topHint.textContent = '🚀 Muévete libremente (↑ ↓ ← →). Se tomará la puerta donde estés al acabar el tiempo';
      } else if (roundIdx === 3) {
        this.activeCanvasGame = this.game4;
        laneQuickBtns.classList.remove('hidden');
        laneQuickBtns.classList.add('flex');
        btnTouchAction.classList.add('hidden');
        topHint.textContent = '⚙️ Elige tu carril (1-4 o flechas). Las opciones bajarán cuando el tiempo llegue a 0';
      } else if (roundIdx === 4) {
        this.activeCanvasGame = this.game5;
        actionBtnText.textContent = 'DISPARAR CAÑÓN (ESPACIO)';
        topHint.textContent = '🎯 Apunta y dispara al globo correcto. Puedes restaurar tu tiro si cambias de opinión';
      }

      this.activeCanvasGame.start(qObj);
    }

    this.syncPlayerState();
    this.updateLiveCountersUI();
    this.startRoundTimer();
  }

  startRoundTimer() {
    clearInterval(this.timerInterval);
    this.timeLeftSec = this.roundDurationSec;
    this.roundStartTime = performance.now();

    this.updateTimerUI();

    this.timerInterval = setInterval(() => {
      if (this.roundEvaluated) return;
      const elapsed = (performance.now() - this.roundStartTime) / 1000;
      this.timeLeftSec = Math.max(0, this.roundDurationSec - elapsed);
      this.updateTimerUI();

      if (this.timeLeftSec <= 0) {
        clearInterval(this.timerInterval);
        this.triggerTimeZeroSequence();
      }
    }, 100);
  }

  /**
   * Cuando el tiempo llega a 0:
   * En el Juego 4 (Cintas), primero bajan las opciones por la cinta y al llegar abajo se evalúa.
   * En los demás juegos, se evalúa de inmediato.
   */
  triggerTimeZeroSequence() {
    if (this.roundEvaluated) return;
    clearInterval(this.timerInterval);
    this.timeLeftSec = 0;
    this.updateTimerUI();

    if (this.currentRound === 3 && this.activeCanvasGame === this.game4) {
      const statusChip = document.getElementById('roundStatusChip');
      statusChip.textContent = '¡Tiempo agotado! Bajando respuestas...';
      this.game4.triggerDropWhenTimeZero(() => {
        this.evaluateCurrentRound();
      });
    } else {
      this.evaluateCurrentRound();
    }
  }

  updateTimerUI() {
    const timerNum = document.getElementById('timerNumber');
    const bar = document.getElementById('timerProgressBar');
    timerNum.textContent = `${Math.ceil(this.timeLeftSec)}s`;
    const pct = Math.max(0, (this.timeLeftSec / this.roundDurationSec) * 100);
    bar.style.width = `${pct}%`;
  }

  /**
   * Registra la opción elegida o restaurada por el jugador y actualiza el contador X/Y
   */
  onPlayerSelectOption(optionIdx, hasAnswered = true) {
    if (this.roundEvaluated) return;
    this.selectedAnswerIndex = optionIdx;
    this.hasAnsweredCurrentRound = optionIdx !== null && hasAnswered;

    const statusChip = document.getElementById('roundStatusChip');
    if (optionIdx === null) {
      statusChip.textContent = 'Selección restaurada - ¡Elige de nuevo!';
      statusChip.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40';
    } else {
      statusChip.textContent = `Opción ${optionIdx + 1} seleccionada`;
      statusChip.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/40';
    }

    this.syncPlayerState();
    this.updateLiveCountersUI();
  }

  /**
   * Revela la respuesta correcta en el juego activo, calcula puntos/racha x1.5 y muestra
   * la pantalla intermedia con el Top 10 de jugadores.
   */
  evaluateCurrentRound() {
    if (this.roundEvaluated) return;
    this.roundEvaluated = true;
    clearInterval(this.timerInterval);

    const qObj = this.quizData.questions[this.currentRound];
    const correctIdx = qObj.correctIndex;

    if (this.currentRound === 0) {
      this.game1.reveal(correctIdx);
    } else if (this.activeCanvasGame) {
      this.activeCanvasGame.reveal(correctIdx);
    }

    const isCorrect = this.selectedAnswerIndex === correctIdx;
    const result = this.scoreSystem.evaluateAnswer(isCorrect);

    if (isCorrect) {
      this.sound.correct();
    } else {
      this.sound.wrong();
    }

    this.updateHudScoreAndStreak();
    this.syncPlayerState();

    const nextLabel = this.currentRound < 4 ? 'Siguiente Juego / Continuar' : 'Ver Podio Final 🏆';
    document.getElementById('btnAdminNextLabel').textContent = nextLabel;
    document.getElementById('btnIntermissionNextText').textContent = nextLabel;

    // Mostrar animación del juego por 1.4 segundos y abrir la pantalla intermedia con Top 10
    setTimeout(() => {
      this.showRoundIntermissionScreen(result, qObj.options[correctIdx]);
    }, 1400);
  }

  /**
   * Muestra entre juego y juego si respondió bien o no, puntos ganados, racha y el Top 10
   */
  showRoundIntermissionScreen(result, correctText) {
    document.getElementById('screenGame').classList.add('hidden');
    document.getElementById('screenRoundResults').classList.remove('hidden');

    const card = document.getElementById('intermissionPlayerCard');
    const icon = document.getElementById('intermissionIcon');
    const title = document.getElementById('intermissionTitle');
    const subtitle = document.getElementById('intermissionSubtitle');
    const streakBanner = document.getElementById('intermissionStreakBanner');

    if (result.isCorrect) {
      card.className = 'rounded-2xl p-5 border bg-emerald-950/90 border-emerald-400/50 text-center shadow-lg';
      icon.textContent = '🎉';
      title.textContent = `¡Respuesta Correcta! +${result.totalEarned} pts`;
      subtitle.textContent = result.inStreak
        ? `Puntaje base 100 pts × 1.5 por racha = +${result.totalEarned} puntos sumados a tu total`
        : `Sumaste +${result.totalEarned} puntos a tu puntaje total`;
    } else {
      card.className = 'rounded-2xl p-5 border bg-rose-950/90 border-rose-400/50 text-center shadow-lg';
      icon.textContent = '💥';
      title.textContent = this.selectedAnswerIndex === null ? 'Sin respuesta (+0 pts)' : 'Respuesta Incorrecta (+0 pts)';
      subtitle.textContent = `La opción correcta era: "${correctText}"`;
    }

    if (result.inStreak) {
      streakBanner.classList.remove('hidden');
      streakBanner.textContent = `🔥 ¡Racha de ${result.currentStreak} aciertos seguidos! (Puntos x1.5 = 150 pts)`;
    } else {
      streakBanner.classList.add('hidden');
    }

    // Controles de avance según rol (Admin vs Jugador)
    const btnNextAdmin = document.getElementById('btnIntermissionNextAdmin');
    const waitMsg = document.getElementById('intermissionWaitingMsg');
    if (this.player.isAdmin) {
      btnNextAdmin.classList.remove('hidden');
      btnNextAdmin.classList.add('inline-flex');
      waitMsg.classList.add('hidden');
    } else {
      btnNextAdmin.classList.add('hidden');
      btnNextAdmin.classList.remove('inline-flex');
      waitMsg.classList.remove('hidden');
    }

    this.renderTop10Intermission();
  }

  renderTop10Intermission() {
    document.getElementById('intermissionRoundLabel').textContent = `Ronda ${this.currentRound + 1} de 5`;
    const players = this.sync.getAllPlayers();
    players.sort((a, b) => b.score - a.score || (b.maxStreak || 0) - (a.maxStreak || 0));
    const top10 = players.slice(0, 10);

    const container = document.getElementById('intermissionTop10List');
    if (top10.length === 0) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Sin jugadores registrados en el ranking.</div>`;
      return;
    }

    container.innerHTML = top10
      .map(
        (p, idx) => `
        <div class="px-4 py-2.5 flex items-center justify-between ${p.id === this.player.id ? 'bg-purple-900/35' : ''}">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-lg ${
              idx === 0
                ? 'bg-amber-400 text-slate-950'
                : idx === 1
                ? 'bg-slate-300 text-slate-900'
                : idx === 2
                ? 'bg-amber-700 text-white'
                : 'bg-slate-800 text-slate-300'
            } font-arcade text-xs flex items-center justify-center font-bold">
              ${idx + 1}
            </span>
            <span class="font-bold text-white text-sm">${p.name}</span>
            ${p.id === this.player.id ? '<span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 font-bold">TÚ</span>' : ''}
          </div>
          <div class="flex items-center gap-3">
            ${(p.streak || 0) >= 2 ? `<span class="text-xs text-orange-400 font-bold">🔥 x${p.streak}</span>` : ''}
            <span class="font-arcade text-sm sm:text-base text-amber-300">${p.score} pts</span>
          </div>
        </div>
      `
      )
      .join('');
  }

  updateHudScoreAndStreak() {
    document.getElementById('hudScoreValue').textContent = this.scoreSystem.score;
    const streakVal = document.getElementById('hudStreakValue');
    const streakIcon = document.getElementById('hudStreakIcon');
    const streakCont = document.getElementById('hudStreakContainer');

    streakVal.textContent = `x${this.scoreSystem.streak}`;

    if (this.scoreSystem.streak >= 2) {
      streakIcon.textContent = '🔥';
      streakCont.className = 'streak-fire flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-600/40 to-red-600/40 border border-orange-400 text-xs sm:text-sm font-bold text-white';
    } else {
      streakIcon.textContent = '⚡';
      streakCont.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs sm:text-sm font-bold';
    }

    this.saveProgressState();
  }

  async advanceToNextRound() {
    const actionId = Date.now();
    this.lastHandledActionId = actionId;

    if (this.currentRound < 4) {
      const nextRound = this.currentRound + 1;
      if (this.player.isAdmin) {
        await this.sync.setSessionState({
          status: 'IN_GAME',
          currentRound: nextRound,
          duration: this.roundDurationSec,
          roundActionId: actionId
        });
      }
      this.loadRound(nextRound);
    } else {
      if (this.player.isAdmin) {
        await this.sync.setSessionState({
          status: 'PODIUM',
          currentRound: 5,
          roundActionId: actionId
        });
      }
      this.showFinalPodium();
    }
  }

  /**
   * Muestra la Pantalla Final con el Podio (1º, 2º y 3º) y el Ranking
   */
  showFinalPodium() {
    clearInterval(this.timerInterval);
    if (this.activeCanvasGame) {
      this.activeCanvasGame.stop();
      this.activeCanvasGame = null;
    }

    document.getElementById('screenGame').classList.add('hidden');
    document.getElementById('screenRoundResults').classList.add('hidden');
    document.getElementById('screenPodium').classList.remove('hidden');

    // Solo el Admin ve el botón "Jugar de Nuevo"
    const adminPodiumControls = document.getElementById('podiumAdminControls');
    if (this.player.isAdmin) {
      adminPodiumControls.classList.remove('hidden');
    } else {
      adminPodiumControls.classList.add('hidden');
    }

    this.syncPlayerState();
    this.renderPodiumUI();
    this.sound.fanfare();
    this.launchConfetti();
  }

  renderPodiumUI() {
    const players = this.sync.getAllPlayers();
    players.sort((a, b) => b.score - a.score || (b.maxStreak || 0) - (a.maxStreak || 0));

    const first = players[0] || { name: 'Vacante', score: 0, maxStreak: 0 };
    const second = players[1] || { name: 'Vacante', score: 0, maxStreak: 0 };
    const third = players[2] || { name: 'Vacante', score: 0, maxStreak: 0 };

    const pedestalsEl = document.getElementById('podiumPedestals');
    pedestalsEl.innerHTML = `
      <!-- 2º PUESTO (Izquierda) -->
      <div class="flex flex-col items-center">
        <div class="text-center mb-2">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-300 text-slate-900 font-arcade text-xl flex items-center justify-center shadow-lg border-2 border-white mb-1">
            🥈
          </div>
          <p class="font-bold text-white text-xs sm:text-sm truncate max-w-[110px] sm:max-w-[150px]">${second.name}</p>
          <span class="font-arcade text-slate-300 text-sm sm:text-base">${second.score} pts</span>
          <span class="block text-[10px] text-amber-300">🔥 Racha máx: x${second.maxStreak || 0}</span>
        </div>
        <div class="podium-bar w-full h-28 sm:h-36 rounded-t-2xl bg-gradient-to-b from-slate-300 to-slate-500 border-t-4 border-white flex flex-col items-center justify-center shadow-xl">
          <span class="font-arcade text-3xl sm:text-4xl text-slate-900 font-bold">2º</span>
        </div>
      </div>

      <!-- 1º PUESTO (Centro más alto) -->
      <div class="flex flex-col items-center">
        <div class="text-center mb-2">
          <div class="text-2xl animate-bounce mb-0.5">👑</div>
          <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-400 text-slate-950 font-arcade text-2xl flex items-center justify-center shadow-xl border-2 border-yellow-200 mb-1">
            🥇
          </div>
          <p class="font-bold text-amber-300 text-sm sm:text-base truncate max-w-[120px] sm:max-w-[170px]">${first.name}</p>
          <span class="font-arcade text-white text-lg sm:text-xl">${first.score} pts</span>
          <span class="block text-xs text-orange-400 font-bold">🔥 Racha máx: x${first.maxStreak || 0}</span>
        </div>
        <div class="podium-bar w-full h-40 sm:h-52 rounded-t-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 border-t-4 border-yellow-100 flex flex-col items-center justify-center shadow-2xl">
          <span class="font-arcade text-4xl sm:text-5xl text-slate-950 font-bold">1º</span>
        </div>
      </div>

      <!-- 3º PUESTO (Derecha) -->
      <div class="flex flex-col items-center">
        <div class="text-center mb-2">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-700 text-amber-100 font-arcade text-xl flex items-center justify-center shadow-lg border-2 border-amber-400 mb-1">
            🥉
          </div>
          <p class="font-bold text-white text-xs sm:text-sm truncate max-w-[110px] sm:max-w-[150px]">${third.name}</p>
          <span class="font-arcade text-amber-200 text-sm sm:text-base">${third.score} pts</span>
          <span class="block text-[10px] text-amber-300">🔥 Racha máx: x${third.maxStreak || 0}</span>
        </div>
        <div class="podium-bar w-full h-20 sm:h-28 rounded-t-2xl bg-gradient-to-b from-amber-600 to-amber-800 border-t-4 border-amber-400 flex flex-col items-center justify-center shadow-xl">
          <span class="font-arcade text-2xl sm:text-3xl text-white font-bold">3º</span>
        </div>
      </div>
    `;

    document.getElementById('rankingTotalPlayers').textContent = `${players.length} participante(s)`;
    const listEl = document.getElementById('rankingListContainer');
    listEl.innerHTML = players
      .map(
        (p, idx) => `
        <div class="px-4 py-3 flex items-center justify-between ${p.id === this.player.id ? 'bg-purple-900/30' : ''}">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-lg ${
              idx === 0
                ? 'bg-amber-400 text-slate-950'
                : idx === 1
                ? 'bg-slate-300 text-slate-900'
                : idx === 2
                ? 'bg-amber-700 text-white'
                : 'bg-slate-800 text-slate-300'
            } font-arcade text-sm flex items-center justify-center font-bold">
              ${idx + 1}
            </span>
            <div>
              <span class="font-bold text-white text-sm sm:text-base">${p.name}</span>
              ${p.id === this.player.id ? '<span class="ml-2 text-[10px] px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 font-bold">TÚ</span>' : ''}
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-xs text-orange-300 font-semibold">🔥 Racha máx: x${p.maxStreak || 0}</span>
            <span class="font-arcade text-base sm:text-lg text-amber-300">${p.score} pts</span>
          </div>
        </div>
      `
      )
      .join('');
  }

  launchConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 95,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }

  restartToWaitingRoom() {
    this.gameStarted = false;
    this.scoreSystem.reset();
    this.sessionStore.clearProgress();
    this.updateHudScoreAndStreak();
    this.hasAnsweredCurrentRound = false;
    this.selectedAnswerIndex = null;
    this.syncPlayerState();

    document.getElementById('screenPodium').classList.add('hidden');
    document.getElementById('screenRoundResults').classList.add('hidden');
    document.getElementById('screenGame').classList.add('hidden');
    document.getElementById('playerHudBar').classList.add('hidden');
    document.getElementById('screenWaitingRoom').classList.remove('hidden');
    document.getElementById('btnAdminNextLabel').textContent = 'Iniciar Quiz';
    this.renderWaitingRoomUI();
  }

  async syncPlayerState() {
    if (!this.player.name || this.player.isAdmin || this.kicked) return;
    await this.sync.upsertPlayer({
      id: this.player.id,
      name: this.player.name,
      isAdmin: false,
      score: this.scoreSystem.score,
      streak: this.scoreSystem.streak,
      maxStreak: this.scoreSystem.maxStreak,
      answeredRound: this.currentRound,
      hasAnswered: this.hasAnsweredCurrentRound
    });
  }

  /**
   * Manejo de eventos globales en tiempo real desde la Nube (Firestore / Broker WSS Global)
   */
  handleRemoteSessionState(state) {
    if (!state) return;

    // Actualizar selector de tiempo si cambió
    if (state.duration && state.duration !== this.roundDurationSec) {
      this.roundDurationSec = state.duration;
      const selectEl = document.getElementById('adminTimeSelect');
      if (selectEl) selectEl.value = String(state.duration);
    }

    // Si el Admin reinició la sesión general
    if (state.sessionId && state.sessionId !== this.currentSessionId) {
      this.currentSessionId = state.sessionId;
      if (this.loggedIn && state.status === 'WAITING') {
        this.restartToWaitingRoom();
        return;
      }
    }

    if (!this.loggedIn) return;

    // Evitar reprocesar la misma acción en el cliente que la emitió
    if (state.roundActionId && state.roundActionId === this.lastHandledActionId) {
      return;
    }
    this.lastHandledActionId = state.roundActionId || 0;

    if (state.status === 'WAITING') {
      if (this.gameStarted) {
        this.restartToWaitingRoom();
      }
    } else if (state.status === 'IN_GAME') {
      const targetRound = state.currentRound || 0;
      if (!this.gameStarted) {
        this.startQuizSession(targetRound);
      } else if (this.currentRound !== targetRound || this.roundEvaluated) {
        this.loadRound(targetRound);
      }
    } else if (state.status === 'REVEALED') {
      if (this.gameStarted && !this.roundEvaluated && this.currentRound === state.currentRound) {
        this.triggerTimeZeroSequence();
      }
    } else if (state.status === 'PODIUM') {
      if (this.gameStarted) {
        this.showFinalPodium();
      }
    }
  }

  handleRemoteQuestions(questions) {
    this.quizData.setQuestions(questions);
    if (this.gameStarted && !this.roundEvaluated && this.currentRound < 5) {
      this.loadRound(this.currentRound);
    }
  }

  handleRemotePlayersUpdated() {
    this.renderWaitingRoomUI();
    this.updateLiveCountersUI();
    if (!document.getElementById('screenRoundResults').classList.contains('hidden')) {
      this.renderTop10Intermission();
    }
    if (!document.getElementById('screenPodium').classList.contains('hidden')) {
      this.renderPodiumUI();
    }
    const manager = document.getElementById('modalPlayerManager');
    if (manager && !manager.classList.contains('hidden')) {
      this.renderPlayerManager();
    }
  }

  /**
   * Lógica del Editor de las 5 Preguntas del Administrador
   */
  openQuestionEditor(tabIdx = 0) {
    this.editorActiveTab = tabIdx;
    this.renderEditorTabs();
    this.populateEditorTab(tabIdx);
    document.getElementById('modalQuestionEditor').classList.remove('hidden');
  }

  renderEditorTabs() {
    const tabsContainer = document.getElementById('editorTabsContainer');
    tabsContainer.innerHTML = '';
    this.quizData.questions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `px-3.5 py-2 rounded-t-xl text-xs font-bold transition ${
        idx === this.editorActiveTab
          ? 'bg-amber-500 text-slate-950'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`;
      btn.textContent = `Juego ${idx + 1}`;
      btn.addEventListener('click', () => {
        this.saveCurrentTabToMemory();
        this.editorActiveTab = idx;
        this.renderEditorTabs();
        this.populateEditorTab(idx);
      });
      tabsContainer.appendChild(btn);
    });
  }

  populateEditorTab(idx) {
    const q = this.quizData.questions[idx];
    document.getElementById('editorGameLabel').textContent = q.gameTitle;
    document.getElementById('editorQuestionInput').value = q.question;
    for (let i = 0; i < 4; i++) {
      document.getElementById(`editorOpt${i}`).value = q.options[i];
    }
    const radios = document.querySelectorAll('input[name="editorCorrectOption"]');
    radios.forEach((r) => {
      r.checked = parseInt(r.value, 10) === q.correctIndex;
    });
  }

  saveCurrentTabToMemory() {
    const q = this.quizData.questions[this.editorActiveTab];
    if (!q) return;
    q.question = document.getElementById('editorQuestionInput').value.trim() || q.question;
    for (let i = 0; i < 4; i++) {
      const val = document.getElementById(`editorOpt${i}`).value.trim();
      if (val) q.options[i] = val;
    }
    const checkedRadio = document.querySelector('input[name="editorCorrectOption"]:checked');
    if (checkedRadio) {
      q.correctIndex = parseInt(checkedRadio.value, 10);
    }
  }

  showToast(message) {
    const toast = document.getElementById('toastNotification');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-4');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
    }, 2800);
  }

  /**
   * Bucle principal de animación 60 FPS para los Mini-Juegos en Canvas HTML5
   */
  startAnimationLoop() {
    const loop = () => {
      if (this.activeCanvasGame && this.activeCanvasGame.running) {
        this.activeCanvasGame.update();
        this.activeCanvasGame.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
