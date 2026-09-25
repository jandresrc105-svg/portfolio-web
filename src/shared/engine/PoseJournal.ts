import type { Object3D } from 'three';

/**
 * Registro de los objetos que recompusieron su matriz local (los anota {@link PoseCheck}, que sabe cuándo una
 * pose cambió). Quien necesita saber qué se movió no tiene que comparar todas las matrices del mundo en cada
 * frame: solo mira los objetos anotados (la matriz del mundo de un objeto solo cambia si se recompuso él o
 * alguno de sus antecesores). Lo lee la versión unida de cada zona y se vacía una vez por frame. Si se llena
 * (nadie lo vació durante un rato), avisa que se desbordó y quien lo lee revisa todo.
 */
export class PoseJournal {
  /** Registro compartido por toda la página (como la revisión de poses, que se instala una sola vez). */
  public static readonly shared = new PoseJournal();

  private static readonly CAPACITY = 4096;

  private readonly objects: Object3D[] = [];
  private total = 0;
  private full = false;
  private layout = 0;

  /**
   * Objetos anotados desde la última vez que se vació (puede repetir objetos).
   *
   * @returns Objetos.
   */
  public get entries(): readonly Object3D[] {
    return this.objects;
  }

  /**
   * Si se anotaron más objetos de los que caben desde la última vez que se vació (hay que revisar todo).
   *
   * @returns `true` si se desbordó.
   */
  public get overflowed(): boolean {
    return this.full;
  }

  /**
   * Cantidad de recomposiciones desde que se cargó la página (sirve para saber si algo se movió durante un
   * recálculo de matrices, comparando antes y después).
   *
   * @returns Total de recomposiciones.
   */
  public get recorded(): number {
    return this.total;
  }

  /**
   * Versión de la estructura de la escena: cambia cada vez que se agrega, se quita o se cambia de padre un
   * objeto.
   *
   * @returns Versión.
   */
  public get structure(): number {
    return this.layout;
  }

  /**
   * Anota que cambió la estructura de la escena.
   */
  public restructure(): void {
    this.layout += 1;
  }

  /**
   * Anota un objeto que recompuso su matriz local.
   *
   * @param object Objeto.
   */
  public record(object: Object3D): void {
    this.total += 1;
    if (this.objects.length < PoseJournal.CAPACITY) {
      this.objects.push(object);
    } else {
      this.full = true;
    }
  }

  /**
   * Vacía el registro (sin reservar memoria nueva).
   */
  public clear(): void {
    this.objects.length = 0;
    this.full = false;
  }
}
