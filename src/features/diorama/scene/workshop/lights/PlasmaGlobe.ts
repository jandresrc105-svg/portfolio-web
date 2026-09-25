import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import fragmentShader from '../../shaders/plasma.frag.glsl?raw';
import vertexShader from '../../shaders/plasma.vert.glsl?raw';
import { PlasmaHitArea } from './PlasmaHitArea';
import { SmoothLevel } from './SmoothLevel';
import { WoodCrate } from './WoodCrate';

/**
 * Bola de plasma sobre un huacal de madera, en la calle frente al taller: base negra, electrodo central y
 * esfera de vidrio con los filamentos de plasma calculados en un shader (cada píxel mide la distancia de su
 * rayo a diez filamentos que ondulan con el tiempo). Cuando el puntero está sobre el vidrio, los filamentos
 * se juntan en el punto señalado, como cuando se apoya un dedo.
 */
export class PlasmaGlobe {
  private static readonly PLACE = { x: 1.625, y: 0, z: 1.325, turn: 0.12 };
  private static readonly BASE = { top: 0.058, bottom: 0.085, height: 0.07 };
  private static readonly BASE_FINISH = {
    color: 0x0b0b0e,
    roughness: 0.35,
    metalness: 0.2,
    envMapIntensity: 0.5,
  };
  private static readonly GLASS = { radius: 0.1, seat: 0.012, plasma: 0.097, color: 0xb9c6ff, opacity: 0.13 };
  private static readonly GLASS_FINISH = { roughness: 0.05, metalness: 0, envMapIntensity: 0.6 };
  private static readonly ELECTRODE = { radius: 0.016, stem: 0.004, color: 0xff7ae6, glow: 3, off: 0.03 };
  private static readonly PLASMA = { color: 0x9a4dff, core: 0xff9af0, intensity: 2.6 };
  private static readonly LED = { radius: 0.005, height: 0.035, color: 0x4d7cff, glow: 4, off: 0.04 };
  private static readonly HIT = { radius: 0.12 };
  private static readonly RATE = { power: 4, focus: 6, target: 10 };

  public readonly group = new Group();
  public readonly hitArea = new PlasmaHitArea(PlasmaGlobe.HIT.radius);

  private readonly uniforms = {
    uTime: { value: 0 },
    uPower: { value: 0 },
    uFocus: { value: 0 },
    uTarget: { value: new Vector3(0, 0, 1) },
    uRadius: { value: PlasmaGlobe.GLASS.plasma },
    uColor: { value: new Color(PlasmaGlobe.PLASMA.color) },
    uCore: { value: new Color(PlasmaGlobe.PLASMA.core) },
  };
  private readonly electrode = new MeshBasicMaterial({ toneMapped: false });
  private readonly led = new MeshBasicMaterial({ toneMapped: false });
  private readonly glass = new Mesh(
    new SphereGeometry(PlasmaGlobe.GLASS.radius, GeometryDetail.High, GeometryDetail.Medium),
    new MeshStandardMaterial({
      ...PlasmaGlobe.GLASS_FINISH,
      color: PlasmaGlobe.GLASS.color,
      opacity: PlasmaGlobe.GLASS.opacity,
      transparent: true,
      depthWrite: false,
    }),
  );
  private readonly power = new SmoothLevel(1, PlasmaGlobe.RATE.power);
  private readonly focus = new SmoothLevel(0, PlasmaGlobe.RATE.focus);
  private readonly center = new Vector3();
  private readonly aim = new Vector3();

  /**
   * Construye el huacal, la base y la esfera.
   *
   * @param wood Madera del huacal.
   * @param metal Metal del vástago del electrodo.
   * @returns Grupo colocado en la calle.
   */
  public build(wood: Material, metal: Material): Group {
    this.group.add(new WoodCrate().build(wood));
    const { height, top } = WoodCrate.SIZE;
    const seat = height + top;
    this.buildBase(seat);
    this.buildSphere(
      seat + PlasmaGlobe.BASE.height + PlasmaGlobe.GLASS.radius - PlasmaGlobe.GLASS.seat,
      metal,
    );
    const { x, y, z, turn } = PlasmaGlobe.PLACE;
    this.group.position.set(x, y, z);
    this.group.rotation.y = turn;
    return this.group;
  }

  /**
   * Prende o apaga el plasma (con fundido).
   *
   * @param on Si está encendida.
   */
  public setOn(on: boolean): void {
    this.power.set(on ? 1 : 0);
  }

  /**
   * Indica si el puntero está sobre el vidrio (los filamentos se juntan en el punto señalado).
   *
   * @param touched Si está señalada.
   */
  public setTouched(touched: boolean): void {
    this.focus.set(touched ? 1 : 0);
  }

  /**
   * Anima el plasma, el fundido y el enfoque hacia el puntero.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   * @param level Brillo general.
   */
  public update(delta: number, elapsed: number, level: number): void {
    const power = this.power.step(delta) * level;
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uPower.value = power * PlasmaGlobe.PLASMA.intensity;
    this.uniforms.uFocus.value = this.focus.step(delta);
    this.aimAtPointer(delta);
    const electrode = PlasmaGlobe.ELECTRODE;
    this.electrode.color.set(electrode.color).multiplyScalar(Math.max(power * electrode.glow, electrode.off));
    const led = PlasmaGlobe.LED;
    this.led.color.set(led.color).multiplyScalar(Math.max(power * led.glow, led.off));
  }

  /**
   * Gira suavemente la dirección de enfoque hacia el último punto donde el puntero tocó el vidrio.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private aimAtPointer(delta: number): void {
    this.glass.getWorldPosition(this.center);
    this.aim.subVectors(this.hitArea.point, this.center);
    if (this.aim.lengthSq() === 0) {
      return;
    }
    this.aim.normalize();
    const target = this.uniforms.uTarget.value;
    target.lerp(this.aim, 1 - Math.exp(-PlasmaGlobe.RATE.target * delta)).normalize();
  }

  /**
   * Base negra con el LED de encendido al frente.
   *
   * @param y Altura de apoyo (tapa del huacal).
   */
  private buildBase(y: number): void {
    const { top, bottom, height } = PlasmaGlobe.BASE;
    const base = new Mesh(
      new CylinderGeometry(top, bottom, height, GeometryDetail.High),
      new MeshStandardMaterial(PlasmaGlobe.BASE_FINISH),
    );
    base.position.y = y + height / 2;
    const { radius, height: ledHeight } = PlasmaGlobe.LED;
    const led = new Mesh(new SphereGeometry(radius, GeometryDetail.Thin, GeometryDetail.Thin), this.led);
    led.position.set(0, y + ledHeight, (top + bottom) / 2);
    this.group.add(base, led);
  }

  /**
   * Electrodo, plasma (shader aditivo), vidrio y zona de clic.
   *
   * @param y Altura del centro de la esfera.
   * @param metal Metal del vástago.
   */
  private buildSphere(y: number, metal: Material): void {
    this.buildElectrode(y, metal);
    const discharge = new Mesh(
      new SphereGeometry(PlasmaGlobe.GLASS.plasma, GeometryDetail.High, GeometryDetail.Medium),
      this.shader(),
    );
    discharge.position.y = y;
    discharge.renderOrder = 1;
    this.glass.position.y = y;
    this.glass.renderOrder = 2;
    this.hitArea.position.y = y;
    this.group.add(discharge, this.glass, this.hitArea);
  }

  /**
   * Electrodo central encendido sobre su vástago.
   *
   * @param y Altura del centro de la esfera.
   * @param metal Metal del vástago.
   */
  private buildElectrode(y: number, metal: Material): void {
    const { radius } = PlasmaGlobe.GLASS;
    const { radius: ball, stem } = PlasmaGlobe.ELECTRODE;
    const rod = new Mesh(new CylinderGeometry(stem, stem, radius, GeometryDetail.Thin), metal);
    rod.position.y = y - radius / 2;
    const electrode = new Mesh(
      new SphereGeometry(ball, GeometryDetail.Low, GeometryDetail.Low),
      this.electrode,
    );
    electrode.position.y = y;
    this.group.add(rod, electrode);
  }

  /**
   * Material del plasma: aditivo, sin escritura de profundidad.
   *
   * @returns Material de shader.
   */
  private shader(): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  }
}
