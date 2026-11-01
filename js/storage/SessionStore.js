const KEYS = {
  userId: 'edisonQuiz:userId',
  playerName: 'edisonQuiz:playerName',
  room: 'edisonQuiz:room',
  progress: 'edisonQuiz:progress'
};

/**
 * Persistencia local de la sesión (identidad, sala y progreso) para que un
 * refresco de página no obligue a volver a escribir el nombre.
 */
export class SessionStore {
  read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // Si localStorage está bloqueado, la app sigue funcionando sin persistencia
    }
  }

  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
  }

  readJson(key) {
    const raw = this.read(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  writeJson(key, value) {
    this.write(key, JSON.stringify(value));
  }

  getUserId() {
    return this.read(KEYS.userId);
  }

  saveUserId(userId) {
    if (userId) this.write(KEYS.userId, userId);
  }

  getPlayerName() {
    return this.read(KEYS.playerName);
  }

  savePlayerName(name) {
    if (name) this.write(KEYS.playerName, name);
  }

  clearIdentity() {
    this.remove(KEYS.playerName);
  }

  getRoom() {
    return this.read(KEYS.room);
  }

  saveRoom(room) {
    if (room) this.write(KEYS.room, room);
  }

  getProgress() {
    return this.readJson(KEYS.progress);
  }

  saveProgress(progress) {
    this.writeJson(KEYS.progress, progress);
  }

  clearProgress() {
    this.remove(KEYS.progress);
  }
}
