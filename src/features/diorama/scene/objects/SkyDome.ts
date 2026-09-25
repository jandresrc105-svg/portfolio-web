import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { RenderLayer } from '@shared/engine/RenderLayer';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import fragmentShader from '../shaders/sky.frag.glsl?raw';
import vertexShader from '../shaders/sky.vert.glsl?raw';

/**
 * Cielo nocturno procedural: degradado índigo, resplandor de la ciudad en el horizonte
 * y nubes que avanzan iluminadas desde abajo. Los relámpagos lo iluminan con {@link SkyDome.setFlash}.
 */
export class SkyDome extends SceneObject implements Updatable {
  private static readonly RADIUS = 150;
  private static readonly COLORS = {
    zenith: 0x010207,
    horizon: 0x0b0919,
    glow: 0x2e0d24,
    flash: 0xb8c6ff,
  };

  private readonly time = { value: 0 };
  private readonly flash = { value: 0 };

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    this.time.value = elapsed;
  }

  /**
   * Ilumina el cielo por un relámpago.
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
    const geometry = new SphereGeometry(SkyDome.RADIUS, GeometryDetail.Ring, GeometryDetail.High);
    const sky = this.add(new Mesh(geometry, this.material()));
    sky.renderOrder = -1;
    sky.layers.set(RenderLayer.Background);
    sky.frustumCulled = false;
  }

  /**
   * Material del cielo, dibujado por dentro de la esfera y siempre al fondo.
   *
   * @returns Material de shader.
   */
  private material(): ShaderMaterial {
    const { zenith, horizon, glow, flash } = SkyDome.COLORS;
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: this.time,
        uFlash: this.flash,
        uZenith: { value: new Color(zenith) },
        uHorizon: { value: new Color(horizon) },
        uGlow: { value: new Color(glow) },
        uFlashColor: { value: new Color(flash) },
      },
      side: BackSide,
      depthWrite: false,
    });
  }
}
