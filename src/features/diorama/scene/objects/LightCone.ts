import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Mesh, ShaderMaterial } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { DaylightAware } from '../../models/DaylightAware';
import type { Powerable } from '../../models/Powerable';
import { PhotoCell } from '../PhotoCell';
import fragmentShader from '../shaders/cone.frag.glsl?raw';
import vertexShader from '../shaders/cone.vert.glsl?raw';

/**
 * Haz de luz volumétrico falso bajo la farola: un cono aditivo que se desvanece hacia el suelo y en los bordes.
 * Da la sensación de luz atravesando la lluvia sin el costo de un volumen real. Se ve desde la tarde; a pleno
 * sol el haz se pierde.
 */
export class LightCone extends SceneObject implements Powerable, DaylightAware {
  private static readonly APEX = { x: -5.05, y: 4.42, z: -0.95 };
  private static readonly SHAPE = { radius: 2.1, height: 4.4 };
  private static readonly TILT = { x: -0.22, z: -0.12 };
  private static readonly COLOR = 0xcfe0ff;
  private static readonly INTENSITY = 0.16;

  private readonly intensity = { value: 0 };
  private power = 0;
  private night = 1;
  private readonly cell = new PhotoCell();

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.power = level;
    this.refresh();
  }

  /**
   * @inheritdoc
   */
  public setDaylight(level: number): void {
    this.night = this.cell.lamp(level);
    this.refresh();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { radius, height } = LightCone.SHAPE;
    const geometry = new ConeGeometry(radius, height, GeometryDetail.Ring, 1, true);
    geometry.translate(0, -height / 2, 0);
    const cone = this.add(new Mesh(geometry, this.material()), LightCone.APEX);
    cone.rotation.set(LightCone.TILT.x, 0, LightCone.TILT.z);
    cone.renderOrder = 1;
  }

  /**
   * Brillo del haz según la energía y la hora.
   */
  private refresh(): void {
    this.intensity.value = this.power * this.night * LightCone.INTENSITY;
  }

  /**
   * Material aditivo sin escritura de profundidad, visible por ambas caras.
   *
   * @returns Material de shader.
   */
  private material(): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new Color(LightCone.COLOR) },
        uIntensity: this.intensity,
        uHeight: { value: LightCone.SHAPE.height },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
  }
}
