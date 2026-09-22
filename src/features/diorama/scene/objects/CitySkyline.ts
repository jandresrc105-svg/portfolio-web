import { BoxGeometry, Color, InstancedMesh, Object3D, ShaderMaterial } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { RenderLayer } from '@shared/engine/RenderLayer';
import { SceneObject } from '@shared/engine/SceneObject';
import fragmentShader from '../shaders/skyline.frag.glsl?raw';
import vertexShader from '../shaders/skyline.vert.glsl?raw';

/**
 * Ciudad nocturna debajo y alrededor del diorama: cientos de edificios con ventanas encendidas al azar,
 * dibujados en una sola llamada (`InstancedMesh`). Las ventanas se calculan en el shader, sin texturas,
 * y los edificios se funden con la bruma a medida que se alejan o bajan.
 */
export class CitySkyline extends SceneObject {
  private static readonly RING = { min: 42, max: 115 };
  private static readonly BASE_Y = -62;
  private static readonly HEIGHT = { min: 16, max: 46, towerChance: 0.05, tower: 66 };
  private static readonly FOOTPRINT = { min: 3, max: 8.5 };
  private static readonly COLORS = { haze: 0x0b0919, glow: 0x2e0d24, warm: 0xffb56b, cool: 0x9cc8ff };
  private static readonly WINDOW_GLOW = 1.15;

  private readonly flash = { value: 0 };

  /**
   * Crea la ciudad.
   *
   * @param buildings Número de edificios.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly buildings: number,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * Aclara las fachadas durante un relámpago.
   *
   * @param value Intensidad del destello [0, 1].
   */
  public setFlash(value: number): void {
    this.flash.value = value;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const geometry = new BoxGeometry(1, 1, 1);
    geometry.translate(0, 0.5, 0);
    const city = new InstancedMesh(geometry, this.material(), this.buildings);
    const dummy = new Object3D();
    for (let index = 0; index < this.buildings; index += 1) {
      this.placeBuilding(dummy);
      city.setMatrixAt(index, dummy.matrix);
    }
    city.frustumCulled = false;
    city.layers.set(RenderLayer.Background);
    this.add(city);
  }

  /**
   * Ubica un edificio al azar en el anillo que rodea la isla.
   *
   * @param dummy Objeto auxiliar cuya matriz se copia a la instancia.
   */
  private placeBuilding(dummy: Object3D): void {
    const { RING, FOOTPRINT, BASE_Y } = CitySkyline;
    const angle = this.random.range(0, Math.PI * 2);
    const distance = RING.min + (RING.max - RING.min) * Math.sqrt(this.random.next());
    dummy.position.set(Math.cos(angle) * distance, BASE_Y, Math.sin(angle) * distance);
    dummy.rotation.y = this.random.range(0, Math.PI);
    const footprint = this.random.range(FOOTPRINT.min, FOOTPRINT.max);
    dummy.scale.set(footprint, this.height(), this.random.range(FOOTPRINT.min, FOOTPRINT.max));
    dummy.updateMatrix();
  }

  /**
   * Altura de un edificio; unos pocos son torres que asoman por encima de la isla.
   *
   * @returns Altura en metros.
   */
  private height(): number {
    const { min, max, towerChance, tower } = CitySkyline.HEIGHT;
    return this.random.next() < towerChance ? tower : this.random.range(min, max);
  }

  /**
   * Material con ventanas procedurales y bruma.
   *
   * @returns Material de shader.
   */
  private material(): ShaderMaterial {
    const { haze, glow, warm, cool } = CitySkyline.COLORS;
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uHaze: { value: new Color(haze) },
        uGlow: { value: new Color(glow) },
        uWarm: { value: new Color(warm) },
        uCool: { value: new Color(cool) },
        uWindowGlow: { value: CitySkyline.WINDOW_GLOW },
        uFlash: this.flash,
      },
    });
  }
}
