/**
 * =========================================================================
 * ScoreSystem (Sistema de Puntuación y Racha x1.5)
 * - Puntaje Base: 100 pts por acierto.
 * - Racha empieza a partir de la 2da respuesta correcta seguida y multiplica
 *   por 1.5 los puntos de ese juego (100 * 1.5 = 150 pts).
 * =========================================================================
 */
export class ScoreSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
  }

  /**
   * Evalúa una ronda para el jugador actual
   * @param {boolean} isCorrect - Si acertó la opción correcta
   */
  evaluateAnswer(isCorrect) {
    if (!isCorrect) {
      this.streak = 0;
      return {
        isCorrect: false,
        basePoints: 0,
        inStreak: false,
        totalEarned: 0,
        currentStreak: 0,
        totalScore: this.score
      };
    }

    // Incrementar racha de aciertos consecutivos
    this.streak += 1;
    if (this.streak > this.maxStreak) {
      this.maxStreak = this.streak;
    }

    const basePoints = 100;
    const inStreak = this.streak >= 2;
    const totalEarned = inStreak ? Math.round(basePoints * 1.5) : basePoints; // 150 si está en racha (2+ seguidas)

    this.score += totalEarned;

    return {
      isCorrect: true,
      basePoints,
      inStreak,
      totalEarned,
      currentStreak: this.streak,
      totalScore: this.score
    };
  }
}
