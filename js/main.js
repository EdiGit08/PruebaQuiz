import { AppController } from './core/AppController.js';

// Inicializar la aplicación al cargar la ventana
window.onload = function () {
  window.edisonQuizApp = new AppController();
};
