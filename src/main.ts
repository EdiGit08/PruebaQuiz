import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles/icons.css';
import './styles.css';
import { crearServicios } from './infrastructure/crearServicios';
import { AppController } from './presentation/AppController';

function mostrarErrorArranque(mensaje: string): void {
  const texto = document.getElementById('dbStatusText');
  const punto = document.getElementById('dbStatusDot');
  if (texto) texto.textContent = mensaje;
  if (punto) punto.className = 'w-2 h-2 rounded-full bg-rose-400';
}

try {
  const controlador = new AppController(crearServicios());
  void controlador.iniciar().catch(() => {
    mostrarErrorArranque('No se pudo iniciar la app. Revisa la configuración.');
  });
} catch {
  mostrarErrorArranque('No se pudo iniciar la app. Revisa la configuración de Supabase.');
}
