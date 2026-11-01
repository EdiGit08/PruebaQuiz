/**
 * =========================================================================
 * QuizDataManager (Gestión Global de Preguntas en Memoria + Nube)
 * =========================================================================
 */
export class QuizDataManager {
  constructor() {
    this.questions = this.getDefaultQuestions();
  }

  getDefaultQuestions() {
    return [
      {
        gameTitle: 'Juego 1: Kahoot Clásico (Grid 2x2)',
        question: '¿Qué estructura de datos utiliza el principio LIFO (Last In, First Out)?',
        options: ['Cola (Queue)', 'Pila (Stack)', 'Árbol Binario', 'Lista Enlazada'],
        correctIndex: 1
      },
      {
        gameTitle: 'Juego 2: Plataformas 2D (Stickman Jumper)',
        question: '¿Cuál etiqueta de HTML5 se utiliza para dibujar gráficos y físicas 2D mediante JavaScript?',
        options: ['<canvas>', '<svg-physics>', '<frame2d>', '<webgl>'],
        correctIndex: 0
      },
      {
        gameTitle: 'Juego 3: Nave Espacial (Vertical Galaga Doors)',
        question: 'En JavaScript ES6, ¿qué palabra clave define una constante cuya referencia no puede reasignarse?',
        options: ['var', 'static', 'const', 'let'],
        correctIndex: 2
      },
      {
        gameTitle: 'Juego 4: Cintas Transportadoras (Conveyor Lanes)',
        question: '¿Qué protocolo permite comunicación bidireccional en tiempo real entre clientes y servidores web?',
        options: ['WebSocket', 'HTTP Estático', 'FTP Simple', 'SMTP Mail'],
        correctIndex: 0
      },
      {
        gameTitle: 'Juego 5: El Cañón / Tiro al Blanco (Target Cannon)',
        question: '¿Cuál propiedad de CSS Flexbox alinea los elementos a lo largo del eje principal?',
        options: ['align-items', 'display-grid', 'z-index', 'justify-content'],
        correctIndex: 3
      }
    ];
  }

  setQuestions(newQuestions) {
    if (Array.isArray(newQuestions) && newQuestions.length === 5) {
      this.questions = newQuestions;
    }
  }
}
