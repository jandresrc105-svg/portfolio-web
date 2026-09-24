import type { Object3D } from 'three';
import { RenderLayer } from './RenderLayer';

/**
 * Compuerta del render: varias razones pueden sacar un objeto del render (un detalle diminuto, una pieza
 * reemplazada por su versión unida) y vuelve a dibujarse solo cuando ya no queda ninguna. Usar capas en vez de
 * `visible` no pisa la visibilidad que maneja cada pieza, y las luces no se ven afectadas. Lo que saca deja
 * todas sus capas (la de la cámara y la del reflejo de los charcos) y pasa a {@link RenderLayer.Gated}, que el
 * puntero sigue probando; al volver recupera las que tenía.
 */
export class RenderGate {
  private readonly reasons = new Map<Object3D, Set<string>>();
  private readonly masks = new Map<Object3D, number>();

  /**
   * Capas que tiene el objeto cuando no está sacado del render.
   *
   * @param object Objeto.
   * @returns Máscara de capas.
   */
  public layersOf(object: Object3D): number {
    return this.masks.get(object) ?? object.layers.mask;
  }

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
    if (!this.masks.has(object)) {
      this.masks.set(object, object.layers.mask);
      object.layers.set(RenderLayer.Gated);
    }
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
      object.layers.mask = this.masks.get(object) ?? object.layers.mask;
      this.masks.delete(object);
    }
  }
}
