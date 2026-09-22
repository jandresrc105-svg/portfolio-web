import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

/**
 * Detecta qué objeto registrado está bajo el puntero (raycasting) y devuelve su carga asociada.
 */
export class PointerPicker<TPayload> {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly targets = new Map<Object3D, TPayload>();

  /**
   * Registra un objeto seleccionable.
   *
   * @param object Objeto (o zona de impacto) a detectar.
   * @param payload Dato que se devuelve al seleccionarlo.
   */
  public register(object: Object3D, payload: TPayload): void {
    this.targets.set(object, payload);
  }

  /**
   * Actualiza la posición del puntero.
   *
   * @param x Coordenada normalizada [-1, 1] horizontal.
   * @param y Coordenada normalizada [-1, 1] vertical.
   */
  public setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
  }

  /**
   * Busca el objeto registrado más cercano bajo el puntero.
   *
   * @param camera Cámara desde la que se lanza el rayo.
   * @returns Carga del objeto encontrado o `null`.
   */
  public pick(camera: Camera): TPayload | null {
    this.raycaster.setFromCamera(this.pointer, camera);
    const [hit] = this.raycaster.intersectObjects([...this.targets.keys()], false);
    return hit ? (this.targets.get(hit.object) ?? null) : null;
  }
}
