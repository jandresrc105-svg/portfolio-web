import type { Camera } from 'three';

/**
 * Equipo de la escena que el visitante usa con el puntero mientras su sección está abierta (el teléfono de
 * la cabina, el tablero del poste). La experiencia los trata a todos igual (patrón Strategy).
 */
export interface DeviceInteraction {
  /**
   * Avisa si la sección del equipo está abierta.
   *
   * @param active Si está abierta.
   */
  setActive(active: boolean): void;

  /**
   * Actualiza el puntero.
   *
   * @param x Horizontal normalizado [-1, 1].
   * @param y Vertical normalizado [-1, 1].
   */
  setPointer(x: number, y: number): void;

  /**
   * Detecta el control bajo el puntero, lo resalta y suena al entrar en uno nuevo.
   *
   * @param camera Cámara desde la que se mira.
   * @param enabled Si el equipo responde ahora (sección abierta y nada delante).
   * @returns Texto del tooltip del control señalado o `null`.
   */
  hover(camera: Camera, enabled: boolean): string | null;

  /**
   * Usa el control señalado, si hay uno.
   *
   * @returns `true` si se usó un control.
   */
  press(): boolean;

  /**
   * Toma el control señalado para arrastrarlo (perillas, deslizadores), si se puede.
   *
   * @returns Función que recibe el desplazamiento vertical en píxeles desde que se tomó (positivo = hacia
   * arriba), o `null` si no hay un control arrastrable bajo el puntero.
   */
  grab?(): ((pixels: number) => void) | null;

  /**
   * Deja de escuchar al equipo.
   */
  dispose(): void;
}
