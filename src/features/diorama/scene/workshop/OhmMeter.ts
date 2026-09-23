import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from 'three';
import type { OhmLabState } from '../../models/OhmLabState';
import type { OhmDisplays } from './OhmDisplays';

/**
 * Panel de medición del circuito: gabinete de instrumento con una pantalla que muestra V, R, I y P en vivo,
 * la corriente contra el límite del LED y el estado del circuito. Todo el gabinete recibe el puntero. Se
 * construye en un grupo con origen en el centro de la base.
 */
export class OhmMeter {
  private static readonly BODY = { width: 0.19, height: 0.15, depth: 0.09, color: 0x30363d };
  private static readonly BEZEL = { width: 0.178, height: 0.114, depth: 0.004, color: 0x0d0f11 };
  private static readonly SCREEN = {
    width: 0.168,
    height: 0.105,
    y: 0.085,
    glow: 1.25,
    off: 0.05,
    lift: 0.001,
  };
  private static readonly FOOT = { width: 0.17, height: 0.008, depth: 0.08, color: 0x111316 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.25 };
  private static readonly BLINK_RATE = 8;

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly body = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.45, envMapIntensity: 0.5 });
  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private shown = '';

  /**
   * Crea el panel.
   *
   * @param displays Pintor de la pantalla.
   */
  public constructor(private readonly displays: OhmDisplays) {
    const { width, height, depth, color } = OhmMeter.BODY;
    this.body.color.set(color);
    this.hitArea = new Mesh(new BoxGeometry(width, height, depth), this.body);
  }

  /**
   * Construye el gabinete, el bisel y la pantalla.
   *
   * @returns Grupo del panel.
   */
  public build(): Group {
    const { height, depth } = OhmMeter.BODY;
    const foot = OhmMeter.FOOT;
    const base = new Mesh(
      new BoxGeometry(foot.width, foot.height, foot.depth),
      new MeshStandardMaterial({ color: foot.color, roughness: 0.8 }),
    );
    base.position.y = foot.height / 2;
    this.hitArea.position.y = foot.height + height / 2;
    this.group.add(base, this.hitArea);
    this.buildScreen(depth / 2);
    return this.group;
  }

  /**
   * Muestra el estado (redibuja solo si cambió lo que se ve; la alerta parpadea con la sobrecorriente).
   *
   * @param state Estado del circuito.
   * @param level Brillo general (encendido de la escena).
   * @param elapsed Segundos desde el inicio (para el parpadeo).
   */
  public show(state: OhmLabState, level: number, elapsed: number): void {
    const blink = Math.floor(elapsed * OhmMeter.BLINK_RATE) % 2 === 0;
    const key = [state.ohms, state.amps, state.closed, state.burnt, state.stress > 0 && blink].join('|');
    if (key !== this.shown) {
      this.shown = key;
      this.replace(this.displays.meter(state, blink));
    }
    const { glow, off } = OhmMeter.SCREEN;
    this.screen.color.setScalar(Math.max(level * glow, off));
  }

  /**
   * Resalta el gabinete señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = OhmMeter.HIGHLIGHT;
    this.body.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Libera la textura de la pantalla.
   */
  public dispose(): void {
    this.screen.map?.dispose();
  }

  /**
   * Cambia la textura de la pantalla y libera la anterior.
   *
   * @param texture Textura nueva.
   */
  private replace(texture: Texture): void {
    this.screen.map?.dispose();
    this.screen.map = texture;
    this.screen.needsUpdate = true;
  }

  /**
   * Bisel y pantalla al frente del gabinete.
   *
   * @param front Profundidad del frente.
   */
  private buildScreen(front: number): void {
    const bezel = OhmMeter.BEZEL;
    const frame = new Mesh(
      new BoxGeometry(bezel.width, bezel.height, bezel.depth),
      new MeshStandardMaterial({ color: bezel.color, roughness: 0.4 }),
    );
    const screen = OhmMeter.SCREEN;
    frame.position.set(0, screen.y, front + bezel.depth / 2);
    const glass = new Mesh(new PlaneGeometry(screen.width, screen.height), this.screen);
    glass.position.set(0, screen.y, front + bezel.depth + screen.lift);
    this.group.add(frame, glass);
  }
}
