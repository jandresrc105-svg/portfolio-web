import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Respuesta al escalón de un sistema de segundo orden, con su referencia (automatización y control).
 */
export class WaveEmblem extends CanEmblem {
  private static readonly PLOT = { half: 0.56, low: 0.4, high: -0.3, samples: 24 };
  private static readonly RESPONSE = { damping: 3.2, frequency: 13 };
  private static readonly STEP_AT = 0.12;

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    const { half, low, high } = WaveEmblem.PLOT;
    const left = box.x - box.size * half;
    const right = box.x + box.size * half;
    const step = left + box.size * half * 2 * WaveEmblem.STEP_AT;
    context.strokeStyle = flavor.accent;
    context.beginPath();
    context.moveTo(left, box.y + box.size * low);
    context.lineTo(step, box.y + box.size * low);
    context.lineTo(step, box.y + box.size * high);
    context.lineTo(right, box.y + box.size * high);
    context.stroke();
    context.strokeStyle = flavor.ink;
    this.response(context, box, step);
  }

  /**
   * Curva amortiguada que sube con sobrepico y se asienta en la referencia.
   *
   * @param context Contexto 2D.
   * @param box Zona del emblema.
   * @param start Abscisa del escalón.
   */
  private response(context: CanvasRenderingContext2D, box: EmblemBox, start: number): void {
    const { half, low, high, samples } = WaveEmblem.PLOT;
    const { damping, frequency } = WaveEmblem.RESPONSE;
    const span = box.x + box.size * half - start;
    context.beginPath();
    context.moveTo(start, box.y + box.size * low);
    for (let index = 1; index <= samples; index += 1) {
      const t = index / samples;
      const value = 1 - Math.exp(-damping * t) * Math.cos(frequency * t);
      context.lineTo(start + span * t, box.y + box.size * (low + (high - low) * value));
    }
    context.stroke();
  }
}
