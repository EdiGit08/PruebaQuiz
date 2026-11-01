import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * =========================================================================
 * SyncManager (Sincronización Global Multi-Dispositivo en Tiempo Real)
 * - Soporta Firebase Firestore automáticamente y broker global WSS en despliegues
 *   externos (Vercel / Netlify / GitHub Pages) para que funcione entre distintas
 *   máquinas sin depender de caché local.
 * =========================================================================
 */
export class SyncManager {
  constructor(callbacks, options = {}) {
    this.callbacks = callbacks || {};
    this.sessionStore = options.sessionStore || null;
    this.MAX_PLAYERS = 50;
    this.playersMap = new Map();
    this.sessionState = {
      status: 'WAITING',
      currentRound: 0,
      duration: 30,
      roundActionId: 0,
      sessionId: 1
    };

    this.user = null;
    const savedUserId = this.sessionStore?.getUserId();
    this.userId = savedUserId || crypto.randomUUID();
    if (!savedUserId) this.sessionStore?.saveUserId(this.userId);
    this.mode = 'INIT'; // 'FIRESTORE' | 'MQTT_CLOUD'
    this.db = null;
    this.auth = null;
    this.mqttClient = null;
    this.appId = this.resolveAppId();
    this.topicPrefix = `edisonquiz_global_room/${this.appId}`;
  }

  /**
   * Cada despliegue (o cada sala indicada con ?sala=) usa un tema aislado en el
   * broker público. Así nadie de otra instancia aparece en tu partida.
   */
  resolveAppId() {
    if (typeof __app_id !== 'undefined' && __app_id) {
      return this.sanitizeRoomId(__app_id) || 'edison-quiz-global-v1';
    }

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('sala') || params.get('room');
    if (roomParam) {
      const explicitRoom = this.sanitizeRoomId(roomParam);
      if (explicitRoom) {
        this.sessionStore?.saveRoom(explicitRoom);
        return explicitRoom;
      }
    }

    // Recuerda la última sala usada aunque se refresque sin el parámetro ?sala=
    const savedRoom = this.sessionStore?.getRoom();
    if (savedRoom) return savedRoom;

    // Usa el host + carpeta (sin el nombre del archivo) como sala por defecto.
    const dirPath = window.location.pathname.replace(/\/[^/]*\.[^/]*$/, '') || '/';
    const fallbackRoom = `${window.location.host}${dirPath}`;

    return this.sanitizeRoomId(fallbackRoom) || 'edison-quiz-local';
  }

  sanitizeRoomId(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  getRoomId() {
    return this.appId;
  }

  async init() {
    const hasCanvasFirebase = typeof __firebase_config !== 'undefined' && __firebase_config;

    if (hasCanvasFirebase) {
      try {
        const firebaseConfig = JSON.parse(__firebase_config);
        const app = initializeApp(firebaseConfig);
        this.db = getFirestore(app);
        this.auth = getAuth(app);

        // REGLA 3: Autenticar primero antes de cualquier operación Firestore
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(this.auth, __initial_auth_token);
        } else {
          await signInAnonymously(this.auth);
        }

        this.user = this.auth.currentUser;
        this.userId = this.user?.uid || this.userId;
        this.mode = 'FIRESTORE';
        this.setupFirestoreListeners();
        if (this.callbacks.onConnectionChange) {
          this.callbacks.onConnectionChange(true, `Conectado a Sala: ${this.appId}`);
        }
        return;
      } catch (err) {
        console.warn('Pasando a sincronización Cloud WSS global:', err);
      }
    }

    // Si se despliega en Vercel / Netlify / GitHub Pages fuera del entorno de Canvas
    this.initCloudMqttBroker();
  }

  setupFirestoreListeners() {
    if (!this.user || !this.db) return;

    // 1. Escuchar estado global de la sesión (Ruta estricta REGLA 1)
    const sessionDocRef = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'quiz_state', 'session');
    onSnapshot(
      sessionDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          this.sessionState = { ...this.sessionState, ...data };
          if (this.callbacks.onSessionState) {
            this.callbacks.onSessionState(this.sessionState);
          }
        }
      },
      (err) => console.error('Error en snapshot de sesión:', err)
    );

    // 2. Escuchar banco global de preguntas editadas por el Admin
    const questionsDocRef = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'quiz_state', 'questions');
    onSnapshot(
      questionsDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.itemsJson) {
            try {
              const parsed = JSON.parse(data.itemsJson);
              if (this.callbacks.onQuestionsUpdated) {
                this.callbacks.onQuestionsUpdated(parsed);
              }
            } catch (e) {}
          }
        }
      },
      (err) => console.error('Error en snapshot de preguntas:', err)
    );

    // 3. Escuchar colección global de jugadores (REGLA 2: sin queries complejas, filtrado en memoria)
    const playersColRef = collection(this.db, 'artifacts', this.appId, 'public', 'data', 'quiz_players');
    onSnapshot(
      playersColRef,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'removed' && this.callbacks.onPlayerRemoved) {
            this.callbacks.onPlayerRemoved(change.doc.id);
          }
        });
        this.playersMap.clear();
        snap.forEach((docSnap) => {
          const pData = docSnap.data();
          if (pData && !pData.isAdmin) {
            this.playersMap.set(docSnap.id, pData);
          }
        });
        if (this.callbacks.onPlayersUpdated) {
          this.callbacks.onPlayersUpdated(this.getAllPlayers());
        }
      },
      (err) => console.error('Error en snapshot de jugadores:', err)
    );
  }

  initCloudMqttBroker() {
    this.mode = 'MQTT_CLOUD';
    if (typeof mqtt === 'undefined') {
      if (this.callbacks.onConnectionChange) {
        this.callbacks.onConnectionChange(false, 'Modo Local (Sin red externa)');
      }
      return;
    }

    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    this.mqttClient = mqtt.connect(brokerUrl, {
      clientId: 'edison_' + this.userId.substring(0, 12) + '_' + Math.floor(Math.random() * 1000),
      clean: true,
      reconnectPeriod: 2000
    });

    this.mqttClient.on('connect', () => {
      if (this.callbacks.onConnectionChange) {
        this.callbacks.onConnectionChange(true, `Conectado a Sala: ${this.appId}`);
      }
      this.mqttClient.subscribe(`${this.topicPrefix}/session`, { qos: 1 });
      this.mqttClient.subscribe(`${this.topicPrefix}/questions`, { qos: 1 });
      this.mqttClient.subscribe(`${this.topicPrefix}/players/+`, { qos: 1 });
    });

    this.mqttClient.on('message', (topic, messageBuffer) => {
      try {
        const raw = messageBuffer.toString();
        if (!raw) return;
        const data = JSON.parse(raw);

        if (topic === `${this.topicPrefix}/session`) {
          this.sessionState = { ...this.sessionState, ...data };
          if (this.callbacks.onSessionState) {
            this.callbacks.onSessionState(this.sessionState);
          }
        } else if (topic === `${this.topicPrefix}/questions`) {
          if (Array.isArray(data.questions) && this.callbacks.onQuestionsUpdated) {
            this.callbacks.onQuestionsUpdated(data.questions);
          }
        } else if (topic.startsWith(`${this.topicPrefix}/players/`)) {
          const pId = topic.split('/').pop();
          const currentSessionId = this.sessionState.sessionId || 1;

          if (data.deleted) {
            this.playersMap.delete(pId);
            if (this.callbacks.onPlayerRemoved) {
              this.callbacks.onPlayerRemoved(pId);
            }
          } else if ((data.sessionId || 1) !== currentSessionId) {
            // Jugador retenido de una partida anterior: se elimina también del broker
            this.playersMap.delete(pId);
            this.purgeRetainedPlayer(pId);
          } else if (!data.isAdmin) {
            this.playersMap.set(pId, data);
          }

          if (this.callbacks.onPlayersUpdated) {
            this.callbacks.onPlayersUpdated(this.getAllPlayers());
          }
        }
      } catch (e) {}
    });
  }

  /**
   * Borra del broker el mensaje retenido de un jugador que ya no pertenece
   * a la sesión actual (publicar un payload vacío con retain lo elimina).
   */
  purgeRetainedPlayer(playerId) {
    if (this.mode !== 'MQTT_CLOUD' || !this.mqttClient?.connected) return;
    this.mqttClient.publish(`${this.topicPrefix}/players/${playerId}`, '', {
      qos: 1,
      retain: true
    });
  }

  async removePlayer(playerId) {
    this.playersMap.delete(playerId);
    if (this.callbacks.onPlayersUpdated) {
      this.callbacks.onPlayersUpdated(this.getAllPlayers());
    }

    if (this.mode === 'FIRESTORE') {
      if (!this.user || !this.db) return;
      const pDocRef = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'quiz_players', playerId);
      try {
        await deleteDoc(pDocRef);
      } catch (e) {
        console.error('Error eliminando jugador de Firestore:', e);
      }
    } else if (this.mode === 'MQTT_CLOUD' && this.mqttClient?.connected) {
      const topic = `${this.topicPrefix}/players/${playerId}`;
      this.mqttClient.publish(topic, JSON.stringify({ deleted: true }), { qos: 1, retain: true });
      this.mqttClient.publish(topic, '', { qos: 1, retain: true });
    }
  }

  getSessionState() {
    return this.sessionState;
  }

  async setSessionState(partialState) {
    this.sessionState = {
      ...this.sessionState,
      ...partialState,
      updatedAt: Date.now()
    };

    if (this.mode === 'FIRESTORE') {
      if (!this.user || !this.db) return this.sessionState;
      const sessionDocRef = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'quiz_state', 'session');
      try {
        await setDoc(sessionDocRef, this.sessionState, { merge: true });
      } catch (e) {
        console.error('Error guardando sesión en Firestore:', e);
      }
    } else if (this.mode === 'MQTT_CLOUD' && this.mqttClient?.connected) {
      this.mqttClient.publish(
        `${this.topicPrefix}/session`,
        JSON.stringify(this.sessionState),
        { qos: 1, retain: true }
      );
    }
    return this.sessionState;
  }

  async saveGlobalQuestions(questionsArray) {
    if (this.mode === 'FIRESTORE') {
      if (!this.user || !this.db) return;
      const questionsDocRef = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'quiz_state', 'questions');
      try {
        await setDoc(questionsDocRef, {
          itemsJson: JSON.stringify(questionsArray),
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('Error guardando preguntas en Firestore:', e);
      }
    } else if (this.mode === 'MQTT_CLOUD' && this.mqttClient?.connected) {
      this.mqttClient.publish(
        `${this.topicPrefix}/questions`,
        JSON.stringify({ questions: questionsArray, updatedAt: Date.now() }),
        { qos: 1, retain: true }
      );
    }
  }

  getAllPlayers() {
    const currentSessionId = this.sessionState.sessionId || 1;
    const list = Array.from(this.playersMap.values()).filter(
      (p) => !p.isAdmin && (p.sessionId || 1) === currentSessionId
    );
    return list;
  }

  async upsertPlayer(playerObj) {
    if (playerObj.isAdmin) return this.getAllPlayers();

    const currentPlayers = this.getAllPlayers();
    const exists = currentPlayers.some(
      (p) => p.id === playerObj.id || p.name.toLowerCase() === playerObj.name.toLowerCase()
    );

    if (!exists && currentPlayers.length >= this.MAX_PLAYERS) {
      return null; // Sala llena (máx 50 jugadores)
    }

    const payload = {
      ...playerObj,
      sessionId: this.sessionState.sessionId || 1,
      updatedAt: Date.now()
    };

    this.playersMap.set(playerObj.id, payload);
    if (this.callbacks.onPlayersUpdated) {
      this.callbacks.onPlayersUpdated(this.getAllPlayers());
    }

    if (this.mode === 'FIRESTORE') {
      if (!this.user || !this.db) return this.getAllPlayers();
      const pDocRef = doc(this.db, 'artifacts', this.appId, 'public', 'data', 'quiz_players', playerObj.id);
      try {
        await setDoc(pDocRef, payload, { merge: true });
      } catch (e) {
        console.error('Error guardando jugador en Firestore:', e);
      }
    } else if (this.mode === 'MQTT_CLOUD' && this.mqttClient?.connected) {
      this.mqttClient.publish(
        `${this.topicPrefix}/players/${playerObj.id}`,
        JSON.stringify(payload),
        { qos: 1, retain: true }
      );
    }

    return this.getAllPlayers();
  }
}
