import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { PanelKey } from '../../models/PanelKey';

/**
 * Tecla de goma del osciloscopio: plástico teñido de su color, luz de fondo (encendida, apagada o en rojo
 * de alerta), un brillo tenue al señalarla y un hundimiento breve al pulsarla. Mira hacia +z con la base en
 * z = 0.
 */
export class ScopeKey {
  private static readonly DEPTH = 0.004;
  private static readonly ROUNDING = 1 / 3;
  private static readonly TINT = 0.45;
  private static readonly ROUGHNESS = 0.7;
  private static readonly ALERT = 0xff3b30;
  private static readonly HOVER = { color: 0x3fd8ff, strength: 0.25 };
  private static readonly PRESS = { depth: 0.6, duration: 0.14 };

  public readonly mesh: Mesh;

  private readonly material: MeshStandardMaterial;
  private readonly light = new Color();
  private readonly rest: number;
  private level = 0;
  private alert = false;
  private hovered = false;
  private pressed = 0;

  /**
   * Crea la tecla.
   *
   * @param key Diseño de la tecla (medidas, color, luz y control).
   * @param position Centro de la cara trasera de la tecla, en el espacio del osciloscopio.
   * @param position.x Horizontal.
   * @param position.y Vertical.
   * @param position.z Profundidad (cara del panel).
   */
  public constructor(
    public readonly key: PanelKey,
    position: { x: number; y: number; z: number },
  ) {
    const lit = key.glow > 0;
    this.material = new MeshStandardMaterial({
      color: new Color(key.color).multiplyScalar(lit ? ScopeKey.TINT : 1),
      roughness: ScopeKey.ROUGHNESS,
    });
    const depth = ScopeKey.DEPTH;
    this.mesh = new Mesh(
      new RoundedBoxGeometry(key.width, key.height, depth, 1, depth * ScopeKey.ROUNDING),
      this.material,
    );
    this.rest = position.z + depth / 2;
    this.mesh.position.set(position.x, position.y, this.rest);
  }

  /**
   * Malla que recibe el puntero.
   *
   * @returns Malla de la tecla.
   */
  public get hitArea(): Object3D {
    return this.mesh;
  }

  /**
   * Fija la luz de fondo.
   *
   * @param level Intensidad [0, 1] (0 = apagada).
   * @param alert Si se ilumina en rojo (p. ej. STOP).
   */
  public setLight(level: number, alert: boolean): void {
    this.level = level;
    this.alert = alert;
    this.paint();
  }

  /**
   * Enciende o apaga el brillo de "señalada".
   *
   * @param hovered Si el puntero está sobre la tecla.
   */
  public setHighlight(hovered: boolean): void {
    this.hovered = hovered;
    this.paint();
  }

  /**
   * Hunde la tecla un instante.
   */
  public press(): void {
    this.pressed = ScopeKey.PRESS.duration;
  }

  /**
   * Anima el regreso de la tecla después de pulsarla.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    if (this.pressed <= 0) {
      return;
    }
    this.pressed = Math.max(this.pressed - delta, 0);
    const sink = (this.pressed / ScopeKey.PRESS.duration) * ScopeKey.DEPTH * ScopeKey.PRESS.depth;
    this.mesh.position.z = this.rest - sink;
  }

  /**
   * Aplica luz de fondo y brillo de señalada como emisión del material.
   */
  private paint(): void {
    const { glow, color } = this.key;
    this.light.set(this.alert ? ScopeKey.ALERT : color).multiplyScalar(this.level * glow);
    if (this.hovered) {
      this.light.add(new Color(ScopeKey.HOVER.color).multiplyScalar(ScopeKey.HOVER.strength));
    }
    this.material.emissive.copy(this.light);
  }
}
