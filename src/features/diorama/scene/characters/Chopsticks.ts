import {
  BoxGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Palillos en la mano de un personaje que come, cruzando hacia el centro como se sostienen, con unas hebras de
 * fideos que cuelgan de la punta mientras los lleva a la boca.
 */
export class Chopsticks {
  private static readonly STICK = { length: 0.22, size: 0.007, spread: 0.012, color: 0x8a5634 };
  private static readonly GRIP = { x: 0.01, y: -0.04, z: 0, tiltX: 2.2, tiltY: 0.5, tiltZ: 0 };
  private static readonly NOODLES = {
    strands: 3,
    length: 0.14,
    radius: 0.004,
    spread: 0.01,
    color: 0xf2d27a,
  };
  private static readonly VISIBLE = { from: 0.08, to: 0.92 };

  private readonly sticks = new Group();
  private readonly noodles = new Group();
  private readonly tip = new Vector3();

  /**
   * Pone los palillos en la mano y los fideos en el personaje.
   *
   * @param hand Articulación de la mano que los sostiene.
   * @param root Raíz del personaje (los fideos cuelgan en su espacio).
   */
  public constructor(
    hand: Object3D,
    private readonly root: Object3D,
  ) {
    this.buildSticks();
    this.buildNoodles();
    hand.add(this.sticks);
    root.add(this.noodles);
  }

  /**
   * Muestra los palillos (solo mientras come) y cuelga los fideos de la punta mientras suben a la boca.
   *
   * @param eating Si está comiendo.
   * @param bite Cuánto está llevando fideos a la boca [0, 1].
   */
  public follow(eating: boolean, bite: number): void {
    this.sticks.visible = eating;
    this.sticks.updateWorldMatrix(true, false);
    this.sticks.localToWorld(this.tip.set(0, 0, Chopsticks.STICK.length));
    this.root.worldToLocal(this.tip);
    this.noodles.position.copy(this.tip);
    const { from, to } = Chopsticks.VISIBLE;
    this.noodles.visible = eating && bite > from && bite < to;
  }

  /**
   * Dos palillos de madera.
   */
  private buildSticks(): void {
    const { length, size, spread, color } = Chopsticks.STICK;
    const { x, y, z, tiltX, tiltY, tiltZ } = Chopsticks.GRIP;
    const wood = new MeshStandardMaterial({ color, roughness: 0.5 });
    [-spread, spread].forEach((offset) => {
      const stick = new Mesh(new BoxGeometry(size, size, length).translate(0, 0, length / 2), wood);
      stick.position.x = offset;
      this.sticks.add(stick);
    });
    this.sticks.position.set(x, y, z);
    this.sticks.rotation.set(tiltX, tiltY, tiltZ);
  }

  /**
   * Hebras de fideos que cuelgan de los palillos.
   */
  private buildNoodles(): void {
    const { strands, length, radius, spread, color } = Chopsticks.NOODLES;
    const pieces = Array.from({ length: strands }, (_strand, index) => {
      const x = (index - (strands - 1) / 2) * spread;
      const curve = new CatmullRomCurve3([
        new Vector3(x, 0, 0),
        new Vector3(x + spread, -length / 2, spread),
        new Vector3(x, -length, 0),
      ]);
      return new TubeGeometry(curve, GeometryDetail.Low, radius, GeometryDetail.Wire);
    });
    this.noodles.add(new Mesh(mergeGeometries(pieces), new MeshStandardMaterial({ color, roughness: 0.35 })));
    pieces.forEach((piece) => {
      piece.dispose();
    });
  }
}
