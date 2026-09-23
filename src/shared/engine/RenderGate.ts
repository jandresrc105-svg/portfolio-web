import type { Object3D } from 'three';
import { RenderLayer } from './RenderLayer';

/**
 * Compuerta de la capa de la cámara (la 0): varias razones pueden sacar un objeto del render (un detalle
 * diminuto, una pieza reemplazada por su versión unida) y vuelve a dibujarse solo cuando ya no queda ninguna.
 * Usar capas en vez de `visible` no pisa la visibilidad que maneja cada pieza, y las luces no se ven afectadas.
 * Lo que saca pasa a la capa {@link RenderLayer.Gated}, que el puntero sigue probando.
 */
export class RenderGate {
  private readonly reasons = new Map<Object3D, Set<string>>();

  /**
   * Saca un objeto del render por una razón.
   *
   * @param object Objeto.
   * @param reason Razón (p. ej. `'tiny'`, `'proxy'`).
   */
  public hide(object: Object3D, reason: string): void {
    const set = this.reasons.get(object) ?? new Set<string>();
    set.add(reason);
    this.reasons.set(object, set);
    object.layers.disable(RenderLayer.Default);
    object.layers.enable(RenderLayer.Gated);
  }

  /**
   * Retira una razón; si no queda ninguna, el objeto vuelve al render.
   *
   * @param object Objeto.
   * @param reason Razón.
   */
  public show(object: Object3D, reason: string): void {
    const set = this.reasons.get(object);
    if (!set) {
      return;
    }
    set.delete(reason);
    if (set.size === 0) {
      this.reasons.delete(object);
      object.layers.disable(RenderLayer.Gated);
      object.layers.enable(RenderLayer.Default);
    }
  }
}
