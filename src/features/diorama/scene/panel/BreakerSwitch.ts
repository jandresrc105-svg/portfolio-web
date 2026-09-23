import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';

/**
 * Un breaker de riel DIN: cuerpo, palanca que sube (ON) o baja (OFF) con un golpe seco y un LED que dice si
 * le llega corriente (verde), si está arriba pero la corriente no llega (ámbar) o si está abajo (apagado).
 * Se construye en un grupo con origen en el centro del cuerpo (+z hacia la calle).
 */
export class BreakerSwitch {
  private static readonly LEVER = { width: 0.4, height: 0.03, depth: 0.024, throw: 0.6, rate: 18 };
  private static readonly LED = { size: 0.008, inset: 0.012, live: 0x33ff99, idle: 0xffaa22, glow: 5 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.45 };
  private static readonly SELF_LIGHT = 0.12;
  private static readonly HIT_MARGIN = 1.2;
  private static readonly OFF_GLOW = 0.04;

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly lever = new Group();
  private readonly leverMaterial: MeshStandardMaterial;
  private readonly led = new MeshBasicMaterial();
  private angle = BreakerSwitch.LEVER.throw;
  private on = false;

  /**
   * Crea el breaker.
   *
   * @param size Medidas del cuerpo.
   * @param size.width Ancho.
   * @param size.height Alto.
   * @param size.depth Fondo.
   * @param finish Colores del cuerpo y de la palanca.
   * @param finish.body Color del cuerpo.
   * @param finish.lever Color de la palanca.
   */
  public constructor(
    private readonly size: { width: number; height: number; depth: number },
    private readonly finish: { body: number; lever: number },
  ) {
    const margin = BreakerSwitch.HIT_MARGIN;
    this.hitArea = new Mesh(
      new BoxGeometry(size.width * margin, size.height * margin, size.depth * margin),
      new MeshBasicMaterial({ visible: false }),
    );
    this.leverMaterial = new MeshStandardMaterial({ color: finish.lever, roughness: 0.5 });
  }

  /**
   * Construye el cuerpo, la palanca y el LED.
   *
   * @returns Grupo del breaker.
   */
  public build(): Group {
    const { width, height, depth } = this.size;
    const body = new MeshStandardMaterial({ color: this.finish.body, roughness: 0.6 });
    body.emissive.set(this.finish.body).multiplyScalar(BreakerSwitch.SELF_LIGHT);
    this.group.add(new Mesh(new BoxGeometry(width, height, depth), body), this.hitArea);
    this.buildLever();
    const { size: led, inset } = BreakerSwitch.LED;
    const light = new Mesh(new BoxGeometry(led, led, led), this.led);
    light.position.set(0, height / 2 - inset, depth / 2);
    this.group.add(light);
    this.apply(false, false, 0);
    return this.group;
  }

  /**
   * Fija la posición de la palanca y el LED.
   *
   * @param on Si la palanca está arriba.
   * @param energized Si le llega corriente.
   * @param level Brillo general (encendido de la escena).
   */
  public apply(on: boolean, energized: boolean, level: number): void {
    this.on = on;
    const { live, idle, glow } = BreakerSwitch.LED;
    const lit = on ? level * glow : BreakerSwitch.OFF_GLOW;
    this.led.color.set(energized ? live : idle).multiplyScalar(Math.max(lit, BreakerSwitch.OFF_GLOW));
  }

  /**
   * Resalta la palanca cuando el puntero está encima.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = BreakerSwitch.HIGHLIGHT;
    this.leverMaterial.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Lleva la palanca hacia su posición.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    const { throw: reach, rate } = BreakerSwitch.LEVER;
    const goal = this.on ? -reach : reach;
    this.angle += (goal - this.angle) * Math.min(delta * rate, 1);
    this.lever.rotation.x = this.angle;
  }

  /**
   * Palanca que gira desde el frente del cuerpo.
   */
  private buildLever(): void {
    const { width, depth } = this.size;
    const lever = BreakerSwitch.LEVER;
    const handle = new Mesh(
      new BoxGeometry(width * lever.width, lever.height, lever.depth),
      this.leverMaterial,
    );
    handle.position.set(0, 0, lever.depth / 2);
    this.lever.add(handle);
    this.lever.position.set(0, 0, depth / 2);
    this.group.add(this.lever);
  }
}
