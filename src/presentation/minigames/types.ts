export interface PreguntaMinijuego {
  options: readonly string[];
  correctIndex: number;
}

export type AlSeleccionar = (indice: number | null, bloqueado: boolean) => void;

export interface SonidoMinijuego {
  select(): void;
  jump?(): void;
  shoot?(): void;
}
