import type { CanvasTexture, MeshBasicMaterial } from 'three';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pantalla LCD del calibrador digital: dígitos negros sobre el gris verdoso del cristal líquido, con la
 * unidad a la derecha. Solo se redibuja cuando cambia la lectura y como mucho diez veces por segundo.
 */
export class CaliperDisplay {
  public static readonly MILLIMETERS = 1000;

  private static readonly CANVAS = { width: 128, height: 40 };
  private static readonly REFRESH = 0.1;
  private static readonly LOOK = {
    background: '#a9b89a',
    ink: '#161b16',
    ghost: 'rgba(22, 27, 22, 0.08)',
    digits: 26,
    unit: 11,
    pad: 6,
    unitWidth: 24,
    glow: 1,
    off: 0.05,
  };
  private static readonly DECIMALS = 2;

  public readonly texture: CanvasTexture;

  private readonly context: CanvasRenderingContext2D;
  private shown = '';
  private pending: string;
  private wait = 0;

  /**
   * Crea la pantalla y dibuja el cero.
   *
   * @param textures Fábrica de texturas.
   * @throws {Error} Si el navegador no entrega el contexto de dibujo.
   */
  public constructor(textures: CanvasTextureFactory) {
    const { width, height } = CaliperDisplay.CANVAS;
    this.texture = textures.paint(
      width,
      height,
      (context) => {
        context.clearRect(0, 0, width, height);
      },
      1,
    );
    const context = this.texture.image.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D no disponible');
    }
    this.context = context;
    this.pending = CaliperDisplay.format(0);
    this.draw();
  }

  /**
   * Pide mostrar una lectura (se dibuja en el próximo refresco).
   *
   * @param millimeters Lectura en milímetros.
   */
  public show(millimeters: number): void {
    this.pending = CaliperDisplay.format(millimeters);
  }

  /**
   * Redibuja la pantalla si la lectura cambió y ya pasó el intervalo mínimo.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public refresh(delta: number): void {
    this.wait = Math.max(this.wait - delta, 0);
    if (this.pending !== this.shown && this.wait === 0) {
      this.draw();
      this.wait = CaliperDisplay.REFRESH;
    }
  }

  /**
   * Brillo de la pantalla según el encendido de la escena.
   *
   * @param material Material de la pantalla.
   * @param level Brillo [0, 1].
   */
  public setPower(material: MeshBasicMaterial, level: number): void {
    const { glow, off } = CaliperDisplay.LOOK;
    material.color.setScalar(Math.max(level * glow, off));
  }

  /**
   * Libera la textura.
   */
  public dispose(): void {
    this.texture.dispose();
  }

  /**
   * Dibuja la lectura pendiente: segmentos apagados de fondo, dígitos y unidad.
   */
  private draw(): void {
    const { width, height } = CaliperDisplay.CANVAS;
    const { background, ink, ghost, digits, unit, pad, unitWidth } = CaliperDisplay.LOOK;
    const context = this.context;
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.textBaseline = 'middle';
    context.textAlign = 'right';
    context.font = `bold ${String(digits)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillStyle = ghost;
    context.fillText('888,88', width - unitWidth - pad, height / 2);
    context.fillStyle = ink;
    context.fillText(this.pending, width - unitWidth - pad, height / 2);
    context.font = `bold ${String(unit)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.fillText('mm', width - pad, height / 2);
    this.texture.needsUpdate = true;
    this.shown = this.pending;
  }

  /**
   * Lectura con dos decimales y coma decimal.
   *
   * @param millimeters Milímetros.
   * @returns Texto.
   */
  private static format(millimeters: number): string {
    return millimeters.toFixed(CaliperDisplay.DECIMALS).replace('.', ',');
  }
}
