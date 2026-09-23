import { gsap } from 'gsap';
import { Spherical, Vector3, type PerspectiveCamera, type Vector3Like } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Updatable } from '@shared/engine/Updatable';
import type { CameraShot } from '../models/CameraShot';

/**
 * Cámara del diorama al estilo de un OrbitControls con amortiguación: se arrastra para girar (con inercia),
 * la rueda o el pellizco acercan, y se queda donde se deja. Cada parada del recorrido (la vista general y
 * una por sección) tiene su encuadre y sus límites; ir a una parada es un viaje animado de la cámara.
 * La vista general permite dar la vuelta completa; en una sección el giro y el zoom quedan acotados.
 */
export class CameraDirector implements Updatable {
  private static readonly INTRO: CameraShot = {
    position: { x: 21, y: 14, z: 31 },
    target: { x: 0, y: 0.6, z: 0 },
  };
  private static readonly SHOTS: CameraShot[] = [
    { position: { x: 8.3, y: 6.8, z: 13.7 }, target: { x: -1.6, y: 2.6, z: 0.6 } },
    { position: { x: -1.5, y: 2.3, z: 4.5 }, target: { x: 0.4, y: 1.3, z: 1.1 } },
    { position: { x: 2.88, y: 1.35, z: 2.72 }, target: { x: 3.05, y: 1.08, z: 0.32 } },
    { position: { x: -3.55, y: 1.62, z: 1.3 }, target: { x: -3.28, y: 1.3, z: -0.78 } },
    { position: { x: 0.74, y: 5.2, z: 1.25 }, target: { x: 0.5, y: 4.6, z: -1.24 } },
    { position: { x: 0, y: 4.6, z: -0.1 }, target: { x: -0.3, y: 4.27, z: -1.27 } },
    { position: { x: -0.26, y: 5.25, z: 2.95 }, target: { x: -0.46, y: 4.55, z: -0.95 } },
    { position: { x: -3.99, y: 1.55, z: 1.92 }, target: { x: -4.51, y: 1.4, z: 0.67 } },
  ];
  private static readonly CONTROLS = { damping: 0.06, rotateSpeed: 0.9, zoomSpeed: 0.8 };
  private static readonly TRAVEL = { duration: 1.6, ease: 'power2.inOut', lift: 0.12, maxLift: 1.4 };
  private static readonly OVERVIEW = { minPolar: 0.18, maxPolar: 0.47, minDistance: 0.6, maxDistance: 1.4 };
  private static readonly CLOSE_UP = { azimuth: 0.12, polar: 0.08, minDistance: 0.7, maxDistance: 1.15 };
  private static readonly PORTRAIT_PULLBACK = 0.85;
  private static readonly FOCUS_DOLLY = 0.04;

  public intro = 0;

  private readonly controls: OrbitControls;
  private readonly shots: CameraShot[] = CameraDirector.SHOTS.map((shot) => ({ ...shot }));
  private readonly from = { position: new Vector3(), target: new Vector3() };
  private readonly to = { position: new Vector3(), target: new Vector3() };
  private readonly spherical = new Spherical();
  private readonly offset = new Vector3();
  private tween: gsap.core.Tween | null = null;
  private stop = 0;
  private settled = false;
  private motion: (() => void) | null = null;

  /**
   * Crea la cámara y sus controles (desactivados hasta que termine la intro).
   *
   * @param camera Cámara a controlar.
   * @param element Elemento que recibe el arrastre, la rueda y los gestos táctiles.
   */
  public constructor(
    private readonly camera: PerspectiveCamera,
    element: HTMLElement,
  ) {
    this.controls = CameraDirector.createControls(camera, element);
    this.camera.position.copy(CameraDirector.INTRO.position);
    this.controls.target.copy(CameraDirector.INTRO.target);
    this.camera.lookAt(this.controls.target);
  }

  /**
   * Hace que una parada mire a un punto (p. ej. la vitrina de la máquina) en lugar de su objetivo original,
   * desplazando el encuadre completo y acercándolo un poco.
   *
   * @param point Punto del mundo a mostrar.
   * @param stop Índice de la parada.
   */
  public setFocus(point: Vector3Like, stop: number): void {
    const base = CameraDirector.SHOTS[stop];
    if (!base) {
      return;
    }
    const shift = new Vector3().copy(point).sub(base.target);
    const target = new Vector3().copy(base.target).add(shift);
    const position = new Vector3().copy(base.position).add(shift).lerp(target, CameraDirector.FOCUS_DOLLY);
    this.shots[stop] = { position, target };
  }

  /**
   * Viaja a una parada del recorrido (0 = vista general).
   *
   * @param stop Índice de la parada.
   */
  public travelTo(stop: number): void {
    this.stop = Math.min(Math.max(stop, 0), this.shots.length - 1);
    if (this.intro < 1) {
      return;
    }
    this.tween?.kill();
    this.openLimits();
    this.from.position.copy(this.camera.position);
    this.from.target.copy(this.controls.target);
    this.destination(this.stop);
    this.animateTravel();
  }

  /**
   * Recalcula los límites al cambiar el tamaño (el encuadre se aleja en pantallas verticales).
   */
  public resize(): void {
    if (this.settled && this.tween === null) {
      this.applyLimits();
    }
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    if (this.intro < 1) {
      this.followIntro();
      return;
    }
    if (!this.settled) {
      this.settled = true;
      this.travelTo(this.stop);
      return;
    }
    if (this.tween === null) {
      this.controls.update();
    }
  }

  /**
   * Bloquea el giro de la cámara mientras el visitante gira una perilla de la escena (el zoom sigue).
   *
   * @param locked Si el giro queda bloqueado.
   */
  public lockRotation(locked: boolean): void {
    this.controls.enableRotate = !locked;
  }

  /**
   * Avisa cada vez que la cámara se mueve (arrastre, rueda, inercia o viaje).
   *
   * @param listener Se llama en cada movimiento.
   */
  public onMotion(listener: () => void): void {
    this.controls.addEventListener('change', listener);
    this.motion = listener;
  }

  /**
   * Libera los controles y cancela cualquier viaje en curso.
   */
  public dispose(): void {
    this.tween?.kill();
    this.controls.dispose();
  }

  /**
   * Anima el viaje desde el encuadre actual hasta el destino, con un arco proporcional a la distancia.
   */
  private animateTravel(): void {
    const { duration, ease, lift, maxLift } = CameraDirector.TRAVEL;
    const arc = Math.min(this.from.position.distanceTo(this.to.position) * lift, maxLift);
    const proxy = { t: 0 };
    this.tween = gsap.to(proxy, {
      t: 1,
      duration,
      ease,
      onUpdate: () => {
        this.blend(proxy.t, arc);
      },
      onComplete: () => {
        this.arrive();
      },
    });
  }

  /**
   * Durante la intro la cámara llega volando desde lejos hasta la vista general.
   */
  private followIntro(): void {
    this.destination(0);
    const { position, target } = CameraDirector.INTRO;
    this.from.position.copy(position);
    this.from.target.copy(target);
    this.blend(this.intro, 0);
  }

  /**
   * Coloca la cámara en un punto del viaje, con un arco hacia arriba para no atravesar el puesto.
   *
   * @param t Avance del viaje [0, 1].
   * @param arc Altura máxima del arco.
   */
  private blend(t: number, arc: number): void {
    this.camera.position.lerpVectors(this.from.position, this.to.position, t);
    this.camera.position.y += Math.sin(t * Math.PI) * arc;
    this.controls.target.lerpVectors(this.from.target, this.to.target, t);
    this.camera.lookAt(this.controls.target);
    this.motion?.();
  }

  /**
   * Fin del viaje: fija los límites de la parada y devuelve el control al visitante.
   */
  private arrive(): void {
    this.tween = null;
    this.applyLimits();
    this.controls.enabled = true;
    this.controls.update();
  }

  /**
   * Encuadre de una parada, alejado en pantallas verticales para que se vea completo.
   *
   * @param stop Índice de la parada.
   */
  private destination(stop: number): void {
    const shot = this.shots[stop] ?? CameraDirector.INTRO;
    this.to.target.copy(shot.target);
    this.to.position.copy(shot.position);
    const aspect = this.camera.aspect;
    if (aspect < 1) {
      const factor = 1 + (1 - aspect) * CameraDirector.PORTRAIT_PULLBACK;
      this.to.position.sub(this.to.target).multiplyScalar(factor).add(this.to.target);
    }
  }

  /**
   * Límites de la parada actual: vuelta completa en la vista general, giro y zoom acotados en una sección.
   */
  private applyLimits(): void {
    this.destination(this.stop);
    this.offset.subVectors(this.to.position, this.to.target);
    this.spherical.setFromVector3(this.offset);
    if (this.stop === 0) {
      const { minPolar, maxPolar, minDistance, maxDistance } = CameraDirector.OVERVIEW;
      this.setRange(-Infinity, Infinity, { min: minPolar * Math.PI, max: maxPolar * Math.PI });
      this.setZoom(minDistance, maxDistance);
      return;
    }
    const { azimuth, polar, minDistance, maxDistance } = CameraDirector.CLOSE_UP;
    const { theta, phi } = this.spherical;
    this.setRange(theta - azimuth * Math.PI, theta + azimuth * Math.PI, {
      min: phi - polar * Math.PI,
      max: phi + polar * Math.PI,
    });
    this.setZoom(minDistance, maxDistance);
  }

  /**
   * Fija cuánto se puede acercar y alejar, relativo a la distancia del encuadre.
   *
   * @param min Fracción mínima de la distancia.
   * @param max Fracción máxima de la distancia.
   */
  private setZoom(min: number, max: number): void {
    this.controls.minDistance = this.spherical.radius * min;
    this.controls.maxDistance = this.spherical.radius * max;
  }

  /**
   * Fija los rangos de giro horizontal y vertical.
   *
   * @param minAzimuth Giro horizontal mínimo.
   * @param maxAzimuth Giro horizontal máximo.
   * @param polar Rango vertical (ángulo desde arriba).
   * @param polar.min Mínimo.
   * @param polar.max Máximo.
   */
  private setRange(minAzimuth: number, maxAzimuth: number, polar: { min: number; max: number }): void {
    this.controls.minAzimuthAngle = minAzimuth;
    this.controls.maxAzimuthAngle = maxAzimuth;
    this.controls.minPolarAngle = Math.max(polar.min, 0);
    this.controls.maxPolarAngle = Math.min(polar.max, Math.PI);
  }

  /**
   * Quita los límites y desactiva los controles durante un viaje, para que no frenen la animación.
   */
  private openLimits(): void {
    this.controls.enabled = false;
    this.setRange(-Infinity, Infinity, { min: 0, max: Math.PI });
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
  }

  /**
   * Controles de órbita con amortiguación, sin desplazamiento lateral y desactivados hasta la intro.
   * Se quita el cursor en línea que dejan los controles, para que manden los cursores de la hoja de estilos
   * (mano para girar y puntero sobre lo que se puede usar).
   *
   * @param camera Cámara a controlar.
   * @param element Elemento que recibe los gestos.
   * @returns Controles configurados.
   */
  private static createControls(camera: PerspectiveCamera, element: HTMLElement): OrbitControls {
    const { damping, rotateSpeed, zoomSpeed } = CameraDirector.CONTROLS;
    const controls = new OrbitControls(camera, element);
    controls.enableDamping = true;
    controls.dampingFactor = damping;
    controls.rotateSpeed = rotateSpeed;
    controls.zoomSpeed = zoomSpeed;
    controls.enablePan = false;
    controls.enabled = false;
    element.style.removeProperty('cursor');
    return controls;
  }
}
