import {
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Sphere,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Hotspot } from '../../models/Hotspot';
import type { Powerable } from '../../models/Powerable';

/**
 * Marcador flotante de un punto interactivo: rombo luminoso con anillo que gira.
 * Tiene una esfera invisible más grande para que sea fácil de tocar en móvil. El rombo y el anillo no son mallas
 * propias: el marcador lleva su pose y su encendido, y {@link HotspotMarkers} los dibuja todos juntos.
 */
export class HotspotMarker extends SceneObject implements Updatable, Powerable {
  private static readonly GEM = { radius: 0.075 };
  private static readonly RING = { radius: 0.17, tube: 0.008 };
  private static readonly HIT_RADIUS = 0.42;
  private static readonly BOB = { amplitude: 0.06, speed: 1.8 };
  private static readonly SPIN = 1.2;
  private static readonly HOVER_SCALE = 1.5;
  private static readonly EASING = 8;
  private static readonly MIN_SCALE = 0.001;

  public readonly hitArea = new Mesh(
    new SphereGeometry(HotspotMarker.HIT_RADIUS, GeometryDetail.Hitbox, GeometryDetail.Hitbox),
    new MeshBasicMaterial(),
  );

  private readonly gem = new Object3D();
  private readonly ring = new Object3D();
  private readonly base = new Matrix4();
  private hovered = false;
  private power = 0;

  /**
   * Crea el marcador.
   *
   * @param hotspot Punto interactivo que representa.
   */
  public constructor(public readonly hotspot: Hotspot) {
    super();
  }

  /**
   * Nivel de encendido actual (0 = apagado, 1 = encendido del todo): es la opacidad del rombo y del anillo.
   *
   * @returns Nivel [0, 1].
   */
  public get level(): number {
    return this.power;
  }

  /**
   * Formas del rombo y del anillo (en el espacio del marcador, sin girar), para dibujarlas juntas.
   *
   * @returns Geometrías del rombo y del anillo.
   */
  public static shapes(): { gem: BufferGeometry; ring: BufferGeometry } {
    const { radius, tube } = HotspotMarker.RING;
    return {
      gem: new OctahedronGeometry(HotspotMarker.GEM.radius),
      ring: new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Ring),
    };
  }

  /**
   * Marca el marcador como señalado por el puntero.
   *
   * @param hovered `true` si el puntero está encima.
   */
  public setHovered(hovered: boolean): void {
    this.hovered = hovered;
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.power = level;
    this.root.visible = level > 0;
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    const { amplitude, speed } = HotspotMarker.BOB;
    this.gem.position.y = Math.sin(elapsed * speed) * amplitude;
    this.gem.rotation.y = elapsed * HotspotMarker.SPIN;
    this.ring.rotation.z = elapsed * HotspotMarker.SPIN * 0.5;
    const target = (this.hovered ? HotspotMarker.HOVER_SCALE : 1) * this.power;
    const scale =
      this.root.scale.x + (target - this.root.scale.x) * Math.min(delta * HotspotMarker.EASING, 1);
    this.root.scale.setScalar(Math.max(scale, HotspotMarker.MIN_SCALE));
  }

  /**
   * Pose actual del rombo y del anillo en el mundo (el marcador cuelga directo de la escena).
   *
   * @param gem Matriz donde se escribe la del rombo.
   * @param ring Matriz donde se escribe la del anillo.
   */
  public pose(gem: Matrix4, ring: Matrix4): void {
    const { position, quaternion, scale } = this.root;
    this.base.compose(position, quaternion, scale);
    this.gem.updateMatrix();
    this.ring.updateMatrix();
    gem.multiplyMatrices(this.base, this.gem.matrix);
    ring.multiplyMatrices(this.base, this.ring.matrix);
  }

  /**
   * Esfera que envuelve el rombo y el anillo en el mundo (con el vaivén y la escala actual).
   *
   * @param target Esfera donde se escribe el resultado.
   * @returns La misma esfera.
   */
  public bounds(target: Sphere): Sphere {
    const { radius, tube } = HotspotMarker.RING;
    target.center.copy(this.root.position);
    target.radius = (radius + tube + HotspotMarker.BOB.amplitude) * this.root.scale.x;
    return target;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.hitArea.visible = false;
    this.ring.rotation.x = Math.PI / 2;
    this.add(this.hitArea);
    this.root.position.copy(this.hotspot.anchor);
    this.setPower(0);
  }
}
