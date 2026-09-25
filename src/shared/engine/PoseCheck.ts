import { Object3D } from 'three';
import { PoseJournal } from './PoseJournal';

/**
 * Recompone la matriz local de un objeto solo si su pose cambió. three.js recompone la matriz (posición,
 * rotación y escala) de cada objeto con `matrixAutoUpdate` en cada frame, aunque no se haya movido, y eso marca
 * su matriz del mundo para recalcular y arrastra a todo su subárbol. Aquí cada objeto guarda su última pose y su
 * padre: si nada cambió, no se recompone ni se marca, y la matriz del mundo solo se recalcula si cambió algo
 * más arriba. Se instala una vez para todos los objetos (también los que se piden a mitad de una animación, como
 * la cinemática inversa de los personajes, que siguen viendo sus matrices al día). Un objeto con pivote se
 * recompone siempre, como en three.js. Cada recomposición se anota en el {@link PoseJournal}, igual que cada
 * cambio en la estructura de la escena (agregar, quitar o mover un objeto de padre), para que las tablas de
 * poses de las piezas ({@link PoseTable}) sepan cuándo volver a armarse.
 */
export class PoseCheck {
  private static readonly SIZE = 10;
  private static readonly OFFSET = { quaternion: 3, scale: 7 };
  private static readonly CURRENT = new Float64Array(PoseCheck.SIZE);
  private static installed = false;

  private readonly poses = new WeakMap<Object3D, { values: Float64Array; parent: Object3D | null }>();

  /**
   * Instala la revisión en todos los objetos de three.js (una sola vez por página).
   */
  public install(): void {
    if (PoseCheck.installed) {
      return;
    }
    PoseCheck.installed = true;
    const compose = Reflect.get(Object3D.prototype, 'updateMatrix');
    const changed = (object: Object3D): boolean => object.pivot !== null || this.changed(object);
    const journal = PoseJournal.shared;
    Object3D.prototype.updateMatrix = function updateMatrix(this: Object3D): void {
      if (changed(this)) {
        compose.call(this);
        journal.record(this);
      }
    };
    PoseCheck.watchStructure(journal);
  }

  /**
   * Si la pose o el padre de un objeto cambiaron desde la última vez (y la anota).
   *
   * @param object Objeto.
   * @returns `true` si cambió (o es la primera vez).
   */
  private changed(object: Object3D): boolean {
    const known = this.poses.get(object);
    PoseCheck.write(PoseCheck.CURRENT, object);
    if (known?.parent === object.parent && PoseCheck.same(known.values)) {
      return false;
    }
    const values = known?.values ?? new Float64Array(PoseCheck.SIZE);
    values.set(PoseCheck.CURRENT);
    if (known) {
      known.parent = object.parent;
    } else {
      this.poses.set(object, { values, parent: object.parent });
    }
    return true;
  }

  /**
   * Si la pose guardada es la actual (la que se acaba de anotar en `CURRENT`).
   *
   * @param values Pose guardada.
   * @returns `true` si no cambió.
   */
  private static same(values: Float64Array): boolean {
    const current = PoseCheck.CURRENT;
    for (let index = 0; index < PoseCheck.SIZE; index += 1) {
      if (values[index] !== current[index]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Guarda la pose actual de un objeto.
   *
   * @param values Donde se guarda.
   * @param object Objeto.
   */
  private static write(values: Float64Array, object: Object3D): void {
    const { position, quaternion, scale } = object;
    const { quaternion: q, scale: s } = PoseCheck.OFFSET;
    values[0] = position.x;
    values[1] = position.y;
    values[2] = position.z;
    values[q] = quaternion.x;
    values[q + 1] = quaternion.y;
    values[q + 2] = quaternion.z;
    values[q + 3] = quaternion.w;
    values[s] = scale.x;
    values[s + 1] = scale.y;
    values[s + 2] = scale.z;
  }

  /**
   * Anota en el registro cada cambio de estructura de la escena (agregar, quitar o cambiar de padre un objeto).
   *
   * @param journal Registro de poses.
   */
  private static watchStructure(journal: PoseJournal): void {
    const prototype = Object3D.prototype;
    (['add', 'remove', 'attach'] as const).forEach((name) => {
      const original = Reflect.get(prototype, name) as (this: Object3D, ...objects: Object3D[]) => Object3D;
      Reflect.set(prototype, name, function restructure(this: Object3D, ...objects: Object3D[]): Object3D {
        journal.restructure();
        return original.apply(this, objects);
      });
    });
  }
}
