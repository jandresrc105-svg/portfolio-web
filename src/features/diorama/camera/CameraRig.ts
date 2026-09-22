import { CatmullRomCurve3, Vector2, Vector3, type PerspectiveCamera } from 'three';
import type { Updatable } from '@shared/engine/Updatable';
import type { CameraShot } from '../models/CameraShot';

/**
 * Cámara que recorre el diorama siguiendo el scroll a lo largo de una curva suave entre encuadres.
 * El orden de los encuadres coincide con el orden de las secciones de la página.
 * Agrega un leve paralaje con el puntero y aleja la cámara en pantallas verticales.
 */
export class CameraRig implements Updatable {
  private static readonly INTRO: CameraShot = {
    position: { x: 21, y: 14, z: 31 },
    target: { x: 0, y: 0.6, z: 0 },
  };
  private static readonly SHOTS: CameraShot[] = [
    { position: { x: 6.4, y: 3.4, z: 9.2 }, target: { x: -0.4, y: 1.35, z: 0.2 } },
    { position: { x: 1.6, y: 1.95, z: 5.6 }, target: { x: -0.6, y: 1.85, z: 0.9 } },
    { position: { x: 5.6, y: 1.9, z: 4.9 }, target: { x: 2.7, y: 1.2, z: 0.2 } },
    { position: { x: 0.25, y: 1.7, z: 2.35 }, target: { x: -1.95, y: 1.2, z: 0.75 } },
    { position: { x: -4.6, y: 2.3, z: 3.2 }, target: { x: -2.7, y: 1.5, z: -1 } },
    { position: { x: 0.2, y: 1.55, z: 5.4 }, target: { x: -3.2, y: 1.05, z: 1.9 } },
  ];
  private static readonly DAMPING = 3.2;
  private static readonly PARALLAX = { x: 0.35, y: 0.2 };
  private static readonly PORTRAIT_PULLBACK = 0.85;

  public intro = 0;

  private readonly positions = CameraRig.curve(CameraRig.SHOTS.map((shot) => shot.position));
  private readonly targets = CameraRig.curve(CameraRig.SHOTS.map((shot) => shot.target));
  private readonly pointer = new Vector2();
  private readonly position = new Vector3().copy(CameraRig.INTRO.position);
  private readonly target = new Vector3().copy(CameraRig.INTRO.target);
  private readonly desiredPosition = new Vector3();
  private readonly desiredTarget = new Vector3();
  private progress = 0;

  /**
   * Crea el rig.
   *
   * @param camera Cámara a controlar.
   */
  public constructor(private readonly camera: PerspectiveCamera) {
    this.apply();
  }

  /**
   * Fija el avance del recorrido.
   *
   * @param progress Progreso del scroll [0, 1].
   */
  public setProgress(progress: number): void {
    this.progress = Math.min(Math.max(progress, 0), 1);
  }

  /**
   * Fija la posición normalizada del puntero para el paralaje.
   *
   * @param x Horizontal [-1, 1].
   * @param y Vertical [-1, 1].
   */
  public setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number): void {
    this.computeDesired();
    const easing = 1 - Math.exp(-delta * CameraRig.DAMPING);
    this.position.lerp(this.desiredPosition, easing);
    this.target.lerp(this.desiredTarget, easing);
    this.apply();
  }

  /**
   * Calcula el encuadre deseado: punto de la curva, mezclado con el encuadre de la intro mientras dura.
   */
  private computeDesired(): void {
    this.positions.getPoint(this.progress, this.desiredPosition);
    this.targets.getPoint(this.progress, this.desiredTarget);
    this.pullBackForPortrait();
    if (this.intro < 1) {
      this.desiredPosition.lerpVectors(
        new Vector3().copy(CameraRig.INTRO.position),
        this.desiredPosition,
        this.intro,
      );
      this.desiredTarget.lerpVectors(
        new Vector3().copy(CameraRig.INTRO.target),
        this.desiredTarget,
        this.intro,
      );
      this.position.copy(this.desiredPosition);
      this.target.copy(this.desiredTarget);
    }
  }

  /**
   * En pantallas verticales aleja la cámara del objetivo para que el encuadre siga completo.
   */
  private pullBackForPortrait(): void {
    const aspect = this.camera.aspect;
    if (aspect >= 1) {
      return;
    }
    const factor = 1 + (1 - aspect) * CameraRig.PORTRAIT_PULLBACK;
    this.desiredPosition.sub(this.desiredTarget).multiplyScalar(factor).add(this.desiredTarget);
  }

  /**
   * Coloca la cámara y aplica el paralaje en su espacio local.
   */
  private apply(): void {
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
    this.camera.translateX(this.pointer.x * CameraRig.PARALLAX.x);
    this.camera.translateY(this.pointer.y * CameraRig.PARALLAX.y);
    this.camera.lookAt(this.target);
  }

  /**
   * Curva suave que pasa exactamente por cada punto.
   *
   * @param points Puntos de control.
   * @returns Curva Catmull-Rom centrípeta.
   */
  private static curve(points: readonly { x: number; y: number; z: number }[]): CatmullRomCurve3 {
    return new CatmullRomCurve3(
      points.map((point) => new Vector3(point.x, point.y, point.z)),
      false,
      'centripetal',
    );
  }
}
