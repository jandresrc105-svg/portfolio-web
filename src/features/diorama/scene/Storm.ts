import type { DirectionalLight } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../models/Powerable';
import type { CitySkyline } from './objects/CitySkyline';
import type { SkyDome } from './objects/SkyDome';

/**
 * Tormenta eléctrica: cada cierto tiempo un relámpago ilumina el cielo, la ciudad y el diorama
 * (reutilizando la luz de luna, sin agregar luces) y avisa para que suene el trueno con retraso.
 * Se activa al terminar la intro (implementa {@link Powerable}).
 */
export class Storm implements Updatable, Powerable {
  private static readonly FIRST_STRIKE = 5;
  private static readonly INTERVAL = { min: 16, max: 34 };
  private static readonly STRENGTH = { min: 0.45, max: 1 };
  private static readonly THUNDER_DELAY = { near: 0.35, far: 2.4 };
  private static readonly MOON_BOOST = 7;
  private static readonly FLASH_CURVE = [
    { at: 0, value: 0 },
    { at: 0.03, value: 1 },
    { at: 0.09, value: 0.2 },
    { at: 0.15, value: 0.85 },
    { at: 0.24, value: 0.3 },
    { at: 0.6, value: 0 },
  ];

  private enabled = false;
  private nextStrike = 0;
  private strikeTime = Number.NEGATIVE_INFINITY;
  private strength = 0;
  private listener: ((strength: number, delay: number) => void) | null = null;
  private readonly moonIntensity: number;

  /**
   * Crea la tormenta.
   *
   * @param moon Luz de luna que se refuerza durante el destello.
   * @param sky Cielo a iluminar.
   * @param city Ciudad a iluminar.
   * @param random Generador para intervalos e intensidades.
   */
  public constructor(
    private readonly moon: DirectionalLight,
    private readonly sky: SkyDome,
    private readonly city: CitySkyline,
    private readonly random: SeededRandom,
  ) {
    this.moonIntensity = moon.intensity;
  }

  /**
   * Suscribe el manejador que se ejecuta en cada relámpago (para el trueno).
   *
   * @param listener Recibe la intensidad y el retraso del sonido en segundos.
   */
  public onStrike(listener: (strength: number, delay: number) => void): void {
    this.listener = listener;
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.enabled = level > 0;
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    if (!this.enabled) {
      return;
    }
    if (this.nextStrike === 0) {
      this.nextStrike = elapsed + Storm.FIRST_STRIKE;
    }
    if (elapsed >= this.nextStrike) {
      this.strike(elapsed);
    }
    this.illuminate(Storm.flashAt(elapsed - this.strikeTime) * this.strength);
  }

  /**
   * Dispara un relámpago y programa el siguiente.
   *
   * @param elapsed Tiempo actual.
   */
  private strike(elapsed: number): void {
    const { STRENGTH, INTERVAL, THUNDER_DELAY } = Storm;
    this.strikeTime = elapsed;
    this.strength = this.random.range(STRENGTH.min, STRENGTH.max);
    this.nextStrike = elapsed + this.random.range(INTERVAL.min, INTERVAL.max);
    const delay = THUNDER_DELAY.far - (THUNDER_DELAY.far - THUNDER_DELAY.near) * this.strength;
    this.listener?.(this.strength, delay);
  }

  /**
   * Aplica el destello a la escena.
   *
   * @param flash Intensidad actual del destello.
   */
  private illuminate(flash: number): void {
    this.moon.intensity = this.moonIntensity + flash * Storm.MOON_BOOST;
    this.sky.setFlash(flash);
    this.city.setFlash(flash);
  }

  /**
   * Curva del destello: dos golpes de luz rápidos y un apagado suave.
   *
   * @param age Segundos desde el relámpago.
   * @returns Intensidad [0, 1].
   */
  private static flashAt(age: number): number {
    const curve = Storm.FLASH_CURVE;
    const index = curve.findIndex((point) => point.at > age);
    if (age < 0 || index <= 0) {
      return 0;
    }
    const from = curve[index - 1];
    const to = curve[index];
    if (!from || !to) {
      return 0;
    }
    return from.value + ((age - from.at) / (to.at - from.at)) * (to.value - from.value);
  }
}
