import { gsap } from 'gsap';
import type { CameraDirector } from '../camera/CameraDirector';
import { PowerMode } from '../models/PowerMode';
import type { PowerStep } from '../models/PowerStep';

/**
 * Secuencia de encendido (el momento "wow"): la cámara llega volando desde lejos mientras
 * la farola, los faroles, el interior y los neones se van encendiendo en orden.
 */
export class PowerOnSequence {
  private static readonly FLIGHT = { duration: 5.8, ease: 'power3.inOut' };
  private static readonly FADE = { duration: 1.2, ease: 'sine.inOut' };
  private static readonly STRIKE_FRAME = 0.075;
  private static readonly STRIKE = [
    { level: 0.85 },
    { level: 0 },
    { level: 0.5 },
    { level: 0.08 },
    { level: 1 },
    { level: 0.3 },
    { level: 1 },
  ].map(({ level }) => ({ level, duration: PowerOnSequence.STRIKE_FRAME, ease: 'none' }));

  /**
   * Reproduce la secuencia.
   *
   * @param camera Cámara del diorama.
   * @param steps Elementos a encender y cuándo.
   * @param instant Saltar al estado final (movimiento reducido).
   * @returns Promesa que se resuelve al terminar.
   */
  public play(camera: CameraDirector, steps: readonly PowerStep[], instant: boolean): Promise<void> {
    return new Promise((resolve) => {
      const timeline = gsap.timeline({
        onComplete: () => {
          resolve();
        },
      });
      timeline.to(camera, { intro: 1, ...PowerOnSequence.FLIGHT }, 0);
      steps.forEach((step) => {
        PowerOnSequence.schedule(timeline, step);
      });
      if (instant) {
        timeline.progress(1);
      }
    });
  }

  /**
   * Programa el encendido de un elemento en la línea de tiempo.
   *
   * @param timeline Línea de tiempo.
   * @param step Paso de encendido.
   */
  private static schedule(timeline: gsap.core.Timeline, step: PowerStep): void {
    const channel = { level: 0 };
    const onUpdate = (): void => {
      step.target.setPower(channel.level);
    };
    if (step.mode === PowerMode.Fade) {
      timeline.to(channel, { level: 1, ...PowerOnSequence.FADE, onUpdate }, step.at);
      return;
    }
    timeline.to(channel, { keyframes: PowerOnSequence.STRIKE, onUpdate }, step.at);
  }
}
