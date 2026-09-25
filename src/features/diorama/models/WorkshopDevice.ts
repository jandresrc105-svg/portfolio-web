import type { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from './Powerable';
import type { WorkshopControl } from './WorkshopControl';

/**
 * Equipo interactivo del taller de electrónica (patrón Strategy): la pieza 3D que se agrega a la escena y
 * los controles que el visitante usa. {@link WorkshopInteraction} los trata a todos igual: detecta el control
 * bajo el puntero, pide su tooltip, lo resalta, lo pulsa con un clic o lo arrastra (perillas, deslizadores,
 * cables). Cada equipo guarda su propio estado en un service y solo responde con el taller en pantalla.
 */
export interface WorkshopDevice {
  /** Pieza 3D del equipo, construida en el espacio local del taller y colocada con `WorkshopLayout.place`. */
  readonly piece: SceneObject & Updatable & Powerable;

  /**
   * Controles del equipo que reciben el puntero (se piden una vez, después de construir la pieza).
   *
   * @returns Controles.
   */
  controls(): readonly WorkshopControl[];

  /**
   * Texto del tooltip de un control, o `null` si ahora no hace nada.
   *
   * @param id Control.
   * @returns Texto o `null`.
   */
  describe(id: string): string | null;

  /**
   * Usa un control con un clic (sin arrastrar).
   *
   * @param id Control.
   */
  press(id: string): void;

  /**
   * Toma un control para arrastrarlo. Mientras se arrastra la cámara no gira.
   *
   * @param id Control.
   * @returns Función que recibe el desplazamiento vertical en píxeles desde que se tomó (positivo = hacia
   * arriba), o `null` si el control no se arrastra (entonces el clic llama a {@link WorkshopDevice.press}).
   */
  grab(id: string): ((pixels: number) => void) | null;

  /**
   * Resalta el control señalado (y apaga el anterior).
   *
   * @param id Control o `null`.
   */
  highlight(id: string | null): void;

  /**
   * Avisa si el taller está en pantalla (alguna de sus secciones está abierta).
   *
   * @param active Si está en pantalla.
   */
  setActive(active: boolean): void;

  /**
   * Deja de escuchar y libera lo que no sea de la pieza 3D (audio, suscripciones).
   */
  dispose(): void;
}
