import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
  type Vector3Like,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { PhoneDisplay } from '../../models/PhoneDisplay';
import type { PhoneBoothArt } from './PhoneBoothArt';
import { PhoneKeypad } from './PhoneKeypad';

/**
 * Teléfono público verde japonés: carcasa redondeada, pantalla LCD que muestra el estado de la llamada,
 * teclado, ranuras de monedas y tarjeta, luz de llamada, auricular colgado a un costado con su cable y una
 * tarjeta de marcado rápido pegada al lado. Mientras está colgado la luz parpadea; al descolgar, el auricular
 * sube del gancho hacia el visitante y el cable lo sigue. Se construye en un grupo que se suma a la cabina
 * (origen en el centro de la carcasa, +z al frente).
 */
export class PayPhone {
  private static readonly FINISH = {
    body: { color: 0x137a40, roughness: 0.55, metalness: 0.05 },
    slot: { color: 0x07090b, roughness: 0.6 },
    handset: { color: 0x14301f, roughness: 0.4 },
    card: { color: 0xc4c4c4, roughness: 0.9 },
  };
  private static readonly BODY = { width: 0.22, height: 0.38, depth: 0.13, radius: 0.02 };
  private static readonly SCREEN = { width: 0.14, height: 0.052, y: 0.118, lift: 0.004, glow: 0.75 };
  private static readonly KEYPAD_TOP = 0.045;
  private static readonly SLOTS = [
    { width: 0.04, x: 0.06, y: 0.165 },
    { width: 0.1, x: 0, y: -0.15 },
  ];
  private static readonly SLOT = { height: 0.008, depth: 0.01 };
  private static readonly LAMP = { size: 0.02, x: -0.07, y: 0.165, color: 0xff3b3b, glow: 5, speed: 7 };
  private static readonly HOOK = { width: 0.03, height: 0.2, depth: 0.05, x: -0.125, y: 0.01 };
  private static readonly HANDSET = { radius: 0.016, length: 0.17, x: -0.155, y: 0.01, z: 0.025 };
  private static readonly HANDSET_HIT = { width: 0.07, height: 0.24, depth: 0.08 };
  private static readonly HANDSET_HOVER = { color: 0x3fd8ff, strength: 0.3 };
  private static readonly CUP = { width: 0.045, height: 0.04, depth: 0.05, forward: 0.012 };
  private static readonly LIFT = { rise: 0.12, forward: 0.22, tilt: 0.45, turn: 0.6, rate: 5 };
  private static readonly CORD = {
    radius: 0.005,
    start: { x: -0.1, y: -0.17, z: 0.02 },
    sag: 0.12,
    epsilon: 0.001,
  };
  private static readonly CARD = { width: 0.13, height: 0.17, x: 0.2, y: 0, z: -0.095 };
  private static readonly OFF_GLOW = 0.04;

  private readonly group = new Group();
  private readonly handset = new Group();
  private readonly keypad: PhoneKeypad;
  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private readonly screenMesh = new Mesh(
    new PlaneGeometry(PayPhone.SCREEN.width, PayPhone.SCREEN.height),
    this.screen,
  );
  private readonly card = new MeshStandardMaterial(PayPhone.FINISH.card);
  private readonly lamp = new MeshBasicMaterial({ color: PayPhone.LAMP.color });
  private readonly handsetMaterial = new MeshStandardMaterial(PayPhone.FINISH.handset);
  private readonly handsetHit = new Mesh(
    new BoxGeometry(PayPhone.HANDSET_HIT.width, PayPhone.HANDSET_HIT.height, PayPhone.HANDSET_HIT.depth),
    new MeshBasicMaterial({ visible: false }),
  );
  private readonly cord = new Mesh(undefined, this.handsetMaterial);
  private readonly cordEnd = new Vector3();
  private readonly textures: Texture[] = [];
  private level = 0;
  private lifted = false;
  private progress = 0;
  private cordProgress = -1;

  /**
   * Crea el teléfono.
   *
   * @param art Gráficas de la cabina (pantalla, números de las teclas y tarjeta).
   * @param keys Texto de cada tecla, en orden de lectura.
   */
  public constructor(
    private readonly art: PhoneBoothArt,
    keys: readonly string[],
  ) {
    this.keypad = new PhoneKeypad(keys, this.track(art.keys(keys)));
  }

  /**
   * Zonas que reciben el puntero: el auricular, la pantalla y cada tecla.
   *
   * @param hook Id del auricular.
   * @param screen Id de la pantalla.
   * @returns Pares control-malla.
   */
  public controls(hook: string, screen: string): { id: string; hitArea: Object3D }[] {
    return [
      { id: hook, hitArea: this.handsetHit },
      { id: screen, hitArea: this.screenMesh },
      ...this.keypad.controls,
    ];
  }

  /**
   * Construye todas las piezas.
   *
   * @returns Grupo con el teléfono.
   */
  public build(): Group {
    const { width, height, depth, radius } = PayPhone.BODY;
    const body = new MeshStandardMaterial(PayPhone.FINISH.body);
    this.place(new Mesh(new RoundedBoxGeometry(width, height, depth, 2, radius), body), { x: 0, y: 0, z: 0 });
    this.buildFace();
    this.buildHandset();
    this.buildCard();
    this.group.add(this.cord);
    this.refreshCord();
    return this.group;
  }

  /**
   * Descuelga o cuelga: el auricular sube del gancho o vuelve a él con una transición suave.
   *
   * @param lifted `true` para descolgar.
   */
  public setLifted(lifted: boolean): void {
    this.lifted = lifted;
  }

  /**
   * Redibuja la pantalla LCD.
   *
   * @param display Líneas de la pantalla.
   */
  public setDisplay(display: PhoneDisplay): void {
    this.screen.map = this.replace(this.screen.map, this.art.screen(display));
    this.screen.needsUpdate = true;
  }

  /**
   * Redibuja la tarjeta de marcado rápido.
   *
   * @param labels Nombre de cada canal, en el orden de las teclas.
   */
  public setDirectory(labels: readonly string[]): void {
    this.card.map = this.replace(this.card.map, this.art.card(labels));
    this.card.needsUpdate = true;
  }

  /**
   * Resalta el control señalado (tecla o auricular).
   *
   * @param id Control o `null`.
   * @param hook Id del auricular.
   */
  public highlight(id: string | null, hook: string): void {
    this.keypad.highlight(id);
    const { color, strength } = PayPhone.HANDSET_HOVER;
    this.handsetMaterial.emissive.set(color).multiplyScalar(id === hook ? strength : 0);
  }

  /**
   * Hunde una tecla un instante.
   *
   * @param id Tecla.
   */
  public pressKey(id: string): void {
    this.keypad.press(id);
  }

  /**
   * Fija el brillo de la pantalla y de la luz de llamada.
   *
   * @param level 0 = apagado, 1 = encendido completo.
   */
  public setPower(level: number): void {
    this.level = level;
    this.screen.color.setScalar(Math.max(level * PayPhone.SCREEN.glow, PayPhone.OFF_GLOW));
  }

  /**
   * Hace parpadear la luz de llamada mientras está colgado, mueve el auricular y devuelve las teclas.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   */
  public update(delta: number, elapsed: number): void {
    const { color, glow, speed } = PayPhone.LAMP;
    const blinking = this.level > 0 && !this.lifted && Math.sin(elapsed * speed) > 0;
    this.lamp.color.set(color).multiplyScalar(blinking ? glow * this.level : PayPhone.OFF_GLOW);
    this.keypad.update(delta);
    const goal = this.lifted ? 1 : 0;
    this.progress += (goal - this.progress) * Math.min(delta * PayPhone.LIFT.rate, 1);
    this.poseHandset();
    if (Math.abs(this.progress - this.cordProgress) > PayPhone.CORD.epsilon) {
      this.refreshCord();
    }
  }

  /**
   * Libera las texturas de la pantalla, las teclas y la tarjeta.
   */
  public dispose(): void {
    this.textures.splice(0).forEach((texture) => {
      texture.dispose();
    });
  }

  /**
   * Frente de la carcasa: pantalla, teclado, ranuras, luz de llamada y gancho.
   */
  private buildFace(): void {
    const front = PayPhone.BODY.depth / 2;
    this.place(this.screenMesh, { x: 0, y: PayPhone.SCREEN.y, z: front + PayPhone.SCREEN.lift });
    const keypad = this.keypad.build();
    keypad.position.set(0, PayPhone.KEYPAD_TOP, front);
    this.group.add(keypad);
    this.buildSlots(front);
  }

  /**
   * Ranuras de monedas y tarjeta, luz de llamada y gancho del auricular.
   *
   * @param front Coordenada z de la cara frontal.
   */
  private buildSlots(front: number): void {
    const slot = new MeshStandardMaterial(PayPhone.FINISH.slot);
    PayPhone.SLOTS.forEach(({ width, x, y }) => {
      this.box({ x: width, y: PayPhone.SLOT.height, z: PayPhone.SLOT.depth }, { x, y, z: front }, slot);
    });
    const lamp = PayPhone.LAMP;
    this.box({ x: lamp.size, y: lamp.size, z: lamp.size }, { x: lamp.x, y: lamp.y, z: front }, this.lamp);
    const hook = PayPhone.HOOK;
    this.box({ x: hook.width, y: hook.height, z: hook.depth }, { x: hook.x, y: hook.y, z: 0 }, slot);
  }

  /**
   * Auricular: mango cilíndrico con auricular y micrófono en los extremos, colgado en el gancho, con una zona
   * de impacto invisible más grande para tomarlo con facilidad.
   */
  private buildHandset(): void {
    const { radius, length, x, y, z } = PayPhone.HANDSET;
    const { width, height, depth, forward } = PayPhone.CUP;
    const handle = new CylinderGeometry(radius, radius, length, GeometryDetail.Low);
    this.handset.add(new Mesh(handle, this.handsetMaterial), this.handsetHit);
    [{ y: length / 2 }, { y: -length / 2 }].forEach(({ y: end }) => {
      const cup = new Mesh(new BoxGeometry(width, height, depth), this.handsetMaterial);
      cup.position.set(0, end, forward);
      this.handset.add(cup);
    });
    this.handset.position.set(x, y, z);
    this.group.add(this.handset);
  }

  /**
   * Tarjeta de marcado rápido pegada a la pared, a la derecha del teléfono (en blanco hasta que llegan los
   * canales).
   */
  private buildCard(): void {
    const { width, height, x, y, z } = PayPhone.CARD;
    this.card.map = this.track(this.art.card([]));
    this.place(new Mesh(new PlaneGeometry(width, height), this.card), { x, y, z });
  }

  /**
   * Coloca el auricular entre el gancho y la posición de descolgado según el avance de la transición.
   */
  private poseHandset(): void {
    const { x, y, z } = PayPhone.HANDSET;
    const { rise, forward, tilt, turn } = PayPhone.LIFT;
    const amount = this.progress;
    this.handset.position.set(x, y + rise * amount, z + forward * amount);
    this.handset.rotation.set(0, turn * amount, tilt * amount);
  }

  /**
   * Rehace el cable colgante entre la carcasa y el extremo inferior del auricular.
   */
  private refreshCord(): void {
    const { start, sag, radius } = PayPhone.CORD;
    this.cordEnd.set(0, -PayPhone.HANDSET.length / 2, 0);
    this.handset.updateMatrix();
    this.cordEnd.applyMatrix4(this.handset.matrix);
    const from = new Vector3().copy(start);
    const middle = from.clone().lerp(this.cordEnd, 1 / 2);
    middle.y -= sag;
    const curve = new CatmullRomCurve3([from, middle, this.cordEnd.clone()]);
    this.cord.geometry.dispose();
    this.cord.geometry = new TubeGeometry(curve, GeometryDetail.Low, radius, GeometryDetail.Wire);
    this.cordProgress = this.progress;
  }

  /**
   * Cambia una textura por otra y libera la anterior.
   *
   * @param previous Textura anterior (o `null`).
   * @param next Textura nueva.
   * @returns La textura nueva.
   */
  private replace(previous: Texture | null, next: Texture): Texture {
    const index = previous ? this.textures.indexOf(previous) : -1;
    if (previous && index >= 0) {
      this.textures.splice(index, 1);
      previous.dispose();
    }
    return this.track(next);
  }

  /**
   * Registra una textura para liberarla con el teléfono.
   *
   * @param texture Textura.
   * @returns La misma textura.
   */
  private track(texture: Texture): Texture {
    this.textures.push(texture);
    return texture;
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Centro.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    this.place(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }

  /**
   * Agrega una malla al grupo en una posición.
   *
   * @param mesh Malla.
   * @param position Posición local.
   */
  private place(mesh: Mesh, position: Vector3Like): void {
    mesh.position.copy(position);
    this.group.add(mesh);
  }
}
