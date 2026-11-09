import { ErrorDominio } from '../../domain';

const MENSAJE_GENERICO = 'No se pudo completar la operación. Intenta de nuevo.';

const MENSAJES: Record<string, string> = {
  ADMIN_NO_JUEGA: 'El administrador no puede unirse como jugador.',
  ADMIN_REQUERIDO: 'Inicia sesión con una cuenta de administrador.',
  AUTENTICACION_REQUERIDA: 'La sesión no está activa. Recarga la página.',
  CODIGO_INVALIDO: 'El código debe tener 6 caracteres.',
  CODIGO_NO_EXISTE: 'No existe una sala con ese código.',
  CONFIRMACION_REQUERIDA: 'Revisa tu correo para confirmar la cuenta.',
  CONFIGURACION_INVALIDA: 'Falta la configuración de Supabase.',
  CREDENCIALES_INVALIDAS: 'Correo o contraseña inválidos.',
  DATOS_INVALIDOS: 'La información recibida no es válida.',
  DURACION_INVALIDA: 'La duración debe ser 15, 30, 45 o 60 segundos.',
  ERROR_DESCONOCIDO: MENSAJE_GENERICO,
  ERROR_RED: 'No se pudo conectar con el servidor.',
  FUERA_DE_TIEMPO: 'El tiempo de la ronda terminó.',
  NOMBRE_DUPLICADO: 'Ese nombre ya está en uso en la sala.',
  NOMBRE_INVALIDO: 'El nombre debe tener entre 2 y 30 caracteres.',
  NO_AUTORIZADO: 'No tienes permiso para esta acción.',
  NO_ES_JUGADOR: 'No perteneces a esta sala.',
  NO_SE_PUDO_GENERAR_CODIGO: 'No se pudo generar un código. Intenta de nuevo.',
  OPCION_INVALIDA: 'La opción seleccionada no es válida.',
  PREGUNTAS_INCOMPLETAS: 'La sala no tiene las 5 preguntas.',
  PREGUNTAS_INVALIDAS: 'Las preguntas no son válidas.',
  PREGUNTA_INCOMPLETA: 'La pregunta no tiene respuesta correcta.',
  RONDA_INVALIDA: 'La ronda no es válida.',
  RONDA_NO_ACTIVA: 'La ronda ya no está activa.',
  SALA_LLENA: 'La sala alcanzó el límite de 50 jugadores.',
  SALA_NO_EXISTE: 'La sala ya no existe.',
  SESION_INVALIDA: 'La sesión no es válida. Recarga la página.',
  SOLO_EN_ESPERA: 'Solo se puede editar mientras la sala está en espera.',
  TRANSICION_INVALIDA: 'La acción no es válida en el estado actual.',
  '23505': 'Ese nombre ya está en uso en la sala.',
  '42501': 'No tienes permiso para esta acción.',
  PGRST116: 'No se encontró la información solicitada.',
  anonymous_provider_disabled: 'El acceso anónimo está deshabilitado.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  email_not_confirmed: 'Confirma tu correo antes de entrar.',
  invalid_credentials: 'Correo o contraseña incorrectos.',
  over_email_send_rate_limit: 'Espera un momento antes de volver a intentarlo.',
  signup_disabled: 'El registro está deshabilitado.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es demasiado débil.'
};

interface ErrorConMensaje {
  message: string;
  code?: string;
}

export function traducirError(error: unknown): ErrorDominio {
  if (error instanceof ErrorDominio) return error;
  if (!esErrorConMensaje(error)) {
    return new ErrorDominio('ERROR_DESCONOCIDO', MENSAJE_GENERICO);
  }
  return traducirMensaje(error);
}

function traducirMensaje(error: ErrorConMensaje): ErrorDominio {
  const mensaje = error.message.trim();
  const codigo = error.code?.trim();
  const clave = obtenerClave(mensaje, codigo);
  if (clave) return new ErrorDominio(clave, MENSAJES[clave] ?? MENSAJE_GENERICO);
  if (esErrorDeRed(mensaje)) {
    return new ErrorDominio('ERROR_RED', MENSAJES.ERROR_RED ?? MENSAJE_GENERICO);
  }
  return new ErrorDominio('ERROR_DESCONOCIDO', MENSAJE_GENERICO);
}

function obtenerClave(mensaje: string, codigo: string | undefined): string | null {
  if (MENSAJES[mensaje]) return mensaje;
  if (codigo && MENSAJES[codigo]) return codigo;
  return null;
}

function esErrorConMensaje(valor: unknown): valor is ErrorConMensaje {
  if (typeof valor !== 'object' || valor === null || !('message' in valor)) return false;
  return typeof (valor as { message?: unknown }).message === 'string';
}

function esErrorDeRed(mensaje: string): boolean {
  const normalizado = mensaje.toLowerCase();
  return normalizado.includes('failed to fetch') || normalizado.includes('network');
}
