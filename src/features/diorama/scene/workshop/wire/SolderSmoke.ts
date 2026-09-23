import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsMaterial,
  type Texture,
  type Vector3Like,
} from 'three';

/**
 * Humito del fundente al estañar: unas pocas motas suaves que suben desde la punta del cautín, se mecen y se
 * desvanecen. Es una sola nube de puntos (un draw call); cada mota recorre su vida en bucle y se apaga al
 * final, así no hace falta crear ni borrar nada.
 */
export class SolderSmoke {
  private static readonly COUNT = 14;
  private static readonly RISE = { height: 0.13, speed: 0.55 };
  private static readonly SWAY = { width: 0.012, rate: 5, spread: 0.6 };
  private static readonly LOOK = { size: 0.035, color: 0.32, peak: 4 };
  private static readonly FADE = { rate: 6, min: 0.01 };

  public readonly points: Points;

  private readonly positions = new Float32Array(SolderSmoke.COUNT * 3);
  private readonly colors = new Float32Array(SolderSmoke.COUNT * 3);
  private readonly geometry = new BufferGeometry();
  private readonly spots = new BufferAttribute(this.positions, 3);
  private readonly tints = new BufferAttribute(this.colors, 3);
  private amount = 0;

  /**
   * Crea el humo.
   *
   * @param origin Punto de donde sale (la punta del cautín tocando el cobre).
   * @param dot Textura de mota suave.
   */
  public constructor(
    private readonly origin: Vector3Like,
    dot: Texture,
  ) {
    this.geometry.setAttribute('position', this.spots);
    this.geometry.setAttribute('color', this.tints);
    const material = new PointsMaterial({
      map: dot,
      size: SolderSmoke.LOOK.size,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /**
   * Avanza el humo.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde que inició el loop.
   * @param on Si el cautín está tocando el cobre.
   */
  public update(delta: number, elapsed: number, on: boolean): void {
    this.amount += ((on ? 1 : 0) - this.amount) * Math.min(delta * SolderSmoke.FADE.rate, 1);
    this.points.visible = this.amount > SolderSmoke.FADE.min;
    if (!this.points.visible) {
      return;
    }
    for (let index = 0; index < SolderSmoke.COUNT; index++) {
      this.place(index, (elapsed * SolderSmoke.RISE.speed + index / SolderSmoke.COUNT) % 1);
    }
    this.spots.needsUpdate = true;
    this.tints.needsUpdate = true;
  }

  /**
   * Coloca y tiñe una mota según su edad.
   *
   * @param index Mota.
   * @param age Edad (0 = recién salida, 1 = desvanecida).
   */
  private place(index: number, age: number): void {
    const { width, rate, spread } = SolderSmoke.SWAY;
    const phase = index * spread;
    const offset = index * 3;
    this.positions[offset] = this.origin.x + Math.sin(age * rate + phase) * width * age;
    this.positions[offset + 1] = this.origin.y + age * SolderSmoke.RISE.height;
    this.positions[offset + 2] = this.origin.z + Math.cos(age * rate + phase) * width * age;
    const shade = SolderSmoke.LOOK.color * this.amount * SolderSmoke.LOOK.peak * age * (1 - age);
    this.colors.fill(shade, offset, offset + 3);
  }
}
