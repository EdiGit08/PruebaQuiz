export function porId<T extends HTMLElement>(id: string): T {
  const elemento = document.getElementById(id);
  if (!elemento) throw new Error(`Falta el elemento #${id}`);
  return elemento as T;
}

export function mostrar(elemento: HTMLElement, visible: boolean): void {
  elemento.classList.toggle('hidden', !visible);
}

export function mostrarModal(elemento: HTMLElement, visible: boolean): void {
  elemento.classList.toggle('hidden', !visible);
  elemento.classList.toggle('flex', visible);
}

export function crear<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase?: string,
  texto?: string
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

export function limpiar(elemento: HTMLElement): void {
  elemento.replaceChildren();
}

export function soloClases(elemento: HTMLElement, clases: readonly string[]): void {
  elemento.className = clases.join(' ');
}

export function establecerTexto(id: string, texto: string): void {
  porId(id).textContent = texto;
}

export function leerValor(id: string): string {
  return (porId<HTMLInputElement>(id) as HTMLInputElement).value.trim();
}

export function copiarTexto(texto: string): Promise<void> {
  return navigator.clipboard.writeText(texto);
}
