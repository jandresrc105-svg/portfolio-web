import { AdditiveBlending, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { NeonSignOptions } from './NeonSignOptions';

/**
 * Letrero de neón. El brillo supera el umbral del bloom y proyecta luz de color sobre el asfalto mojado.
 * Una vez encendido, parpadea de vez en cuando como un tubo real con el balastro gastado.
 */
export class NeonSign extends SceneObject implements Updatable, Powerable {
  private static readonly GLOW = 6;
  private static readonly OFF_GLOW = 0.04;
  private static readonly PIXELS_PER_METER = 360;
  private static readonly FLICKER = { chance: 0.0035, duration: 0.14, dim: 0.25 };
  private static readonly TUBE = { glow: 26, core: '#fff4fa', lineWidth: 5 };
  private static readonly LIGHT_OFFSET = 0.55;
  private static readonly EDGE_FADE = 0.16;

  private readonly material = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly light: PointLight;
  private readonly mirrors: Powerable[] = [];
  private level = 0;
  private flickerUntil = 0;

  /**
   * Crea el letrero.
   *
   * @param textures Fábrica de texturas.
   * @param options Configuración del letrero.
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly options: NeonSignOptions,
  ) {
    super();
    this.light = new PointLight(options.lightColor, 0, 0, 2);
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.apply(level);
  }

  /**
   * Replica el brillo real del tubo (incluidos los parpadeos) en otro elemento, p. ej. su zumbido.
   *
   * @param target Elemento que sigue al letrero.
   */
  public mirror(target: Powerable): void {
    this.mirrors.push(target);
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    if (this.level < 1) {
      return;
    }
    if (elapsed > this.flickerUntil && Math.random() < NeonSign.FLICKER.chance) {
      this.flickerUntil = elapsed + NeonSign.FLICKER.duration;
    }
    this.apply(elapsed < this.flickerUntil ? NeonSign.FLICKER.dim : 1);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { size, position, rotationY } = this.options;
    this.material.map = this.own(this.texture());
    const sign = this.add(new Mesh(new PlaneGeometry(size.width, size.height), this.material), position);
    sign.rotation.y = rotationY;
    if (this.options.lightIntensity > 0) {
      this.light.position.set(0, 0, NeonSign.LIGHT_OFFSET).applyEuler(sign.rotation).add(sign.position);
      this.add(this.light);
    }
    this.setPower(0);
  }

  /**
   * Aplica un nivel de brillo al tubo y a la luz.
   *
   * @param level Brillo [0, 1].
   */
  private apply(level: number): void {
    this.material.color.setScalar(Math.max(level * NeonSign.GLOW, NeonSign.OFF_GLOW));
    this.light.intensity = level * this.options.lightIntensity;
    this.mirrors.forEach((mirror) => {
      mirror.setPower(level);
    });
  }

  /**
   * Dibuja el texto como tubo de neón: halo de color y núcleo casi blanco.
   *
   * @returns Textura transparente del letrero.
   */
  private texture(): ReturnType<CanvasTextureFactory['paint']> {
    const width = Math.round(this.options.size.width * NeonSign.PIXELS_PER_METER);
    const height = Math.round(this.options.size.height * NeonSign.PIXELS_PER_METER);
    return this.textures.paint(width, height, (context) => {
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineJoin = 'round';
      const step = height / (this.options.lines.length + 1);
      this.options.lines.forEach((line, index) => {
        this.drawTube(context, line, width / 2, step * (index + 1));
      });
      NeonSign.fadeEdges(context, width, height);
    });
  }

  /**
   * Dibuja una línea de texto en forma de tubo.
   *
   * @param context Contexto 2D.
   * @param line Línea de texto.
   * @param line.text Texto.
   * @param line.size Tamaño en píxeles.
   * @param line.font Familia tipográfica.
   * @param x Centro horizontal.
   * @param y Centro vertical.
   */
  private drawTube(
    context: CanvasRenderingContext2D,
    line: { text: string; size: number; font: string },
    x: number,
    y: number,
  ): void {
    context.font = `700 ${String(line.size)}px ${line.font}`;
    context.shadowColor = this.options.color;
    context.shadowBlur = NeonSign.TUBE.glow;
    context.strokeStyle = this.options.color;
    context.lineWidth = NeonSign.TUBE.lineWidth;
    context.strokeText(line.text, x, y);
    context.shadowBlur = NeonSign.TUBE.glow / 2;
    context.fillStyle = NeonSign.TUBE.core;
    context.fillText(line.text, x, y);
  }

  /**
   * Desvanece el halo hacia los bordes del letrero, para que el resplandor no termine en un corte recto
   * (se veía como un recuadro de luz alrededor del texto).
   *
   * @param context Contexto 2D ya dibujado.
   * @param width Ancho del canvas.
   * @param height Alto del canvas.
   */
  private static fadeEdges(context: CanvasRenderingContext2D, width: number, height: number): void {
    const fade = NeonSign.EDGE_FADE;
    context.save();
    context.globalCompositeOperation = 'destination-in';
    [context.createLinearGradient(0, 0, width, 0), context.createLinearGradient(0, 0, 0, height)].forEach(
      (gradient) => {
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(fade, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1 - fade, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      },
    );
    context.restore();
  }
}
