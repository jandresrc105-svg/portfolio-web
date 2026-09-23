import { Raycaster, Vector2, type Camera, type Intersection, type Object3D } from 'three';

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
   * Lanza el rayo del puntero contra un objeto concreto (p. ej. un `InstancedMesh`, cuyo impacto trae
   * `instanceId`).
   *
   * @param camera Cámara desde la que se lanza el rayo.
   * @param object Objeto a probar.
   * @returns Impacto más cercano o `null`.
   */
  public cast(camera: Camera, object: Object3D): Intersection | null {
    this.raycaster.setFromCamera(this.pointer, camera);
    return this.raycaster.intersectObject(object, false)[0] ?? null;
  }

  /**
   * Busca el objeto registrado más cercano bajo el puntero.
   *
   * @param camera Cámara desde la que se lanza el rayo.
   * @param skip Carga que se ignora (y deja ver lo que hay detrás), p. ej. el marcador de la sección abierta.
   * @returns Carga del objeto encontrado o `null`.
   */
  public pick(camera: Camera, skip: TPayload | null = null): TPayload | null {
    this.raycaster.setFromCamera(this.pointer, camera);
    const hits = this.raycaster.intersectObjects([...this.targets.keys()], false);
    const hit = hits.find((entry) => {
      const payload = this.targets.get(entry.object);
      return payload !== undefined && payload !== skip;
    });
    return hit ? (this.targets.get(hit.object) ?? null) : null;
  }
}
