import { Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Humo del LED quemado: unas bocanadas grises que suben, se abren y se desvanecen. Comparten geometría y
 * material; el grupo queda oculto mientras no hay humo.
 */
export class LedSmoke {
  private static readonly PUFFS = 7;
  private static readonly PUFF = { color: 0x6b6b6b, opacity: 0.55, radius: 0.004, grow: 0.018 };
  private static readonly RISE = { speed: 0.045, stagger: 0.09, drift: 0.012 };
  private static readonly DURATION = 2.6;

  public readonly group = new Group();

  private readonly material = new MeshBasicMaterial({
    color: LedSmoke.PUFF.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  private readonly puffs: { mesh: Mesh; drift: { x: number; z: number } }[] = [];
  private age = LedSmoke.DURATION;

  /**
   * Crea las bocanadas con una deriva determinista.
   *
   * @param random Generador determinista.
   */
  public constructor(random: SeededRandom) {
    const geometry = new SphereGeometry(1, GeometryDetail.Low, GeometryDetail.Low);
    const { drift } = LedSmoke.RISE;
    for (let index = 0; index < LedSmoke.PUFFS; index += 1) {
      const mesh = new Mesh(geometry, this.material);
      this.puffs.push({ mesh, drift: { x: random.range(-drift, drift), z: random.range(-drift, drift) } });
      this.group.add(mesh);
    }
    this.group.visible = false;
  }

  /**
   * Suelta el humo desde el principio.
   */
  public start(): void {
    this.age = 0;
    this.group.visible = true;
  }

  /**
   * Hace subir, crecer y desvanecerse las bocanadas.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    if (!this.group.visible) {
      return;
    }
    this.age += delta;
    const life = this.age / LedSmoke.DURATION;
    if (life >= 1) {
      this.group.visible = false;
      return;
    }
    this.material.opacity = LedSmoke.PUFF.opacity * (1 - life);
    const { speed, stagger } = LedSmoke.RISE;
    const { radius, grow } = LedSmoke.PUFF;
    this.puffs.forEach(({ mesh, drift }, index) => {
      const time = Math.max(this.age - index * stagger, 0);
      mesh.position.set(drift.x * time, speed * time, drift.z * time);
      mesh.scale.setScalar(radius + grow * time);
    });
  }
}
