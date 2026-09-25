import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { OhmLabState } from '../../models/OhmLabState';
import { LedSmoke } from './ohm/LedSmoke';

/**
 * LED rojo grande clavado en la protoboard: patas, pestaña, cuerpo y cúpula. Brilla en proporción a la
 * corriente (con bloom y una luz roja que tiñe la protoboard); con sobrecorriente parpadea sobreexcitado, y
 * al quemarse da un destello blanco, echa humo y queda negro. Se construye en un grupo con origen en la base
 * de sus patas, sobre la protoboard.
 */
export class LedLamp {
  private static readonly LEGS = [{ x: -0.0035 }, { x: 0.0035 }];
  private static readonly LEG = { radius: 0.0007, height: 0.01, color: 0xc9ccd0 };
  private static readonly RIM = { radius: 0.0105, height: 0.002 };
  private static readonly BODY = { radius: 0.009, height: 0.014 };
  private static readonly COLOR = { lit: 0xff2414, dead: 0x140d0b, off: 0.22 };
  private static readonly GLOW = {
    base: 0.6,
    perBrightness: 2.6,
    maxBrightness: 2.5,
    stress: 5,
    flicker: 55,
  };
  private static readonly FLASH = { decay: 9, color: 0xfff0e0, glow: 9 };
  private static readonly LIGHT = {
    color: 0xff3020,
    perBrightness: 0.02,
    flash: 0.35,
    distance: 0.4,
    y: 0.03,
  };
  private static readonly HALO = { radius: 0.015, tube: 0.0011, color: 0x3fd8ff, y: 0.012 };
  private static readonly HIT = { radius: 0.022 };
  private static readonly FOLLOW_RATE = 14;

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new SphereGeometry(LedLamp.HIT.radius, GeometryDetail.Hitbox, GeometryDetail.Hitbox),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly lens = new MeshBasicMaterial({ toneMapped: false });
  private readonly flashColor = new Color(LedLamp.FLASH.color).multiplyScalar(LedLamp.FLASH.glow);
  private readonly halo = new Mesh(
    new TorusGeometry(LedLamp.HALO.radius, LedLamp.HALO.tube, GeometryDetail.Thin, GeometryDetail.Medium),
    new MeshBasicMaterial({ color: LedLamp.HALO.color, toneMapped: false }),
  );
  private readonly light = new PointLight(LedLamp.LIGHT.color, 0, LedLamp.LIGHT.distance, 2);
  private readonly smoke: LedSmoke;
  private state: OhmLabState | null = null;
  private level = 0;
  private brightness = 0;
  private flash = 0;

  /**
   * Crea el LED.
   *
   * @param random Generador determinista (para el humo).
   */
  public constructor(random: SeededRandom) {
    this.smoke = new LedSmoke(random);
  }

  /**
   * Construye las patas, la pestaña, el cuerpo con su cúpula, el resaltado, la luz y el humo.
   *
   * @returns Grupo del LED.
   */
  public build(): Group {
    const leg = LedLamp.LEG;
    const metal = new MeshStandardMaterial({ color: leg.color, roughness: 0.3, metalness: 0.9 });
    LedLamp.LEGS.forEach(({ x }) => {
      const pin = new Mesh(
        new CylinderGeometry(leg.radius, leg.radius, leg.height, GeometryDetail.Thin),
        metal,
      );
      pin.position.set(x, leg.height / 2, 0);
      this.group.add(pin);
    });
    this.buildLens(leg.height);
    this.light.position.y = LedLamp.LIGHT.y;
    this.hitArea.position.y = leg.height + LedLamp.BODY.height;
    this.smoke.group.position.y = leg.height + LedLamp.BODY.height + LedLamp.BODY.radius;
    this.group.add(this.halo, this.light, this.hitArea, this.smoke.group);
    return this.group;
  }

  /**
   * Fija el estado del circuito y el brillo general.
   *
   * @param state Estado del circuito.
   * @param level Brillo general (encendido de la escena).
   */
  public apply(state: OhmLabState, level: number): void {
    this.state = state;
    this.level = level;
  }

  /**
   * Quema el LED: destello y humo.
   */
  public burst(): void {
    this.flash = 1;
    this.smoke.start();
  }

  /**
   * Resalta el LED señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    this.halo.visible = active;
  }

  /**
   * Sigue la corriente con suavidad, parpadea con la sobrecorriente y apaga el destello.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   */
  public update(delta: number, elapsed: number): void {
    const state = this.state;
    const { maxBrightness, stress, flicker } = LedLamp.GLOW;
    const target = state ? Math.min(state.brightness, maxBrightness) : 0;
    this.brightness += (target - this.brightness) * (1 - Math.exp(-LedLamp.FOLLOW_RATE * delta));
    this.flash *= Math.exp(-LedLamp.FLASH.decay * delta);
    const shake =
      state && state.stress > 0 ? state.stress * stress * (0.5 + 0.5 * Math.sin(elapsed * flicker)) : 0;
    this.paint(state?.burnt ?? false, shake);
    this.smoke.update(delta);
  }

  /**
   * Pinta la cúpula y ajusta la luz.
   *
   * @param burnt Si el LED está quemado.
   * @param shake Brillo extra del parpadeo por sobrecorriente.
   */
  private paint(burnt: boolean, shake: number): void {
    const { lit, dead, off } = LedLamp.COLOR;
    const { base, perBrightness } = LedLamp.GLOW;
    const lightOn = this.brightness > 0 ? base + this.brightness * perBrightness : 0;
    const glow = this.level * (lightOn + shake);
    if (burnt) {
      this.lens.color.set(dead);
    } else {
      this.lens.color.set(lit).multiplyScalar(Math.max(glow, off));
    }
    if (this.flash > 0) {
      this.lens.color.lerp(this.flashColor, this.flash);
    }
    const light = LedLamp.LIGHT;
    this.light.intensity = this.level * (this.brightness * light.perBrightness + this.flash * light.flash);
  }

  /**
   * Cuerpo con su pestaña y su cúpula (un solo material que brilla) y el anillo del resaltado.
   *
   * @param y Altura de la base del cuerpo.
   */
  private buildLens(y: number): void {
    const { radius, height } = LedLamp.BODY;
    const rim = LedLamp.RIM;
    const flange = new Mesh(
      new CylinderGeometry(rim.radius, rim.radius, rim.height, GeometryDetail.Medium),
      this.lens,
    );
    flange.position.y = y + rim.height / 2;
    const body = new Mesh(new CylinderGeometry(radius, radius, height, GeometryDetail.Medium), this.lens);
    body.position.y = y + height / 2;
    const dome = new Mesh(
      new SphereGeometry(radius, GeometryDetail.Medium, GeometryDetail.Low, 0, Math.PI * 2, 0, Math.PI / 2),
      this.lens,
    );
    dome.position.y = y + height;
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = LedLamp.HALO.y;
    this.halo.visible = false;
    this.group.add(flange, body, dome);
  }
}
