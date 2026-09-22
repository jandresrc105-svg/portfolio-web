import { Mesh, MeshBasicMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Hotspot } from '../../models/Hotspot';
import type { Powerable } from '../../models/Powerable';

/**
 * Marcador flotante de un punto interactivo: rombo luminoso con anillo que gira.
 * Tiene una esfera invisible más grande para que sea fácil de tocar en móvil.
 */
export class HotspotMarker extends SceneObject implements Updatable, Powerable {
  private static readonly COLOR = 0x5ee7ff;
  private static readonly GLOW = 4;
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

  private readonly material = new MeshBasicMaterial({ color: HotspotMarker.COLOR, transparent: true });
  private readonly gem = new Mesh(new OctahedronGeometry(HotspotMarker.GEM.radius), this.material);
  private readonly ring = new Mesh(
    new TorusGeometry(
      HotspotMarker.RING.radius,
      HotspotMarker.RING.tube,
      GeometryDetail.Thin,
      GeometryDetail.Ring,
    ),
    this.material,
  );
  private hovered = false;
  private level = 0;

  /**
   * Crea el marcador.
   *
   * @param hotspot Punto interactivo que representa.
   */
  public constructor(public readonly hotspot: Hotspot) {
    super();
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
    this.level = level;
    this.material.opacity = level;
    this.material.color.set(HotspotMarker.COLOR).multiplyScalar(HotspotMarker.GLOW);
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
    const target = (this.hovered ? HotspotMarker.HOVER_SCALE : 1) * this.level;
    const scale =
      this.root.scale.x + (target - this.root.scale.x) * Math.min(delta * HotspotMarker.EASING, 1);
    this.root.scale.setScalar(Math.max(scale, HotspotMarker.MIN_SCALE));
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.hitArea.visible = false;
    this.ring.rotation.x = Math.PI / 2;
    this.add(this.gem);
    this.add(this.ring);
    this.add(this.hitArea);
    this.root.position.copy(this.hotspot.anchor);
    this.setPower(0);
  }
}
