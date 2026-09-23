import { CapsuleGeometry, Group, Mesh, SphereGeometry, type Material } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Pata levantada del gato de la suerte: brazo que sale del hombro, muñeca articulada y mano redonda con sus
 * almohadillas rosadas mirando al frente. El gesto es el de "ven": la mano se dobla hacia adelante y abajo
 * desde la muñeca mientras el brazo acompaña un poco, y vuelve a subir. Se construye en un grupo con origen
 * en el hombro (+y arriba, +z al frente del gato).
 */
export class ManekiPaw {
  private static readonly ARM = { radius: 0.019, length: 0.045, spread: -0.22 };
  private static readonly HAND = { radius: 0.025, y: 0.018, scale: { x: 1, y: 1.05, z: 0.8 } };
  private static readonly PAD = { radius: 0.009, y: 0.012, z: 0.018, flatten: 0.4 };
  private static readonly BEANS = [
    { x: -0.011, y: 0.03 },
    { x: 0, y: 0.036 },
    { x: 0.011, y: 0.03 },
  ];
  private static readonly BEAN = { radius: 0.0048, z: 0.016, flatten: 0.5 };
  private static readonly BECKON = { speed: 3.2, curl: 1.15, rest: 0.08, lean: 0.14 };

  public readonly group = new Group();

  private readonly wrist = new Group();

  /**
   * Crea la pata.
   *
   * @param fur Material del pelaje.
   * @param pink Material de las almohadillas.
   */
  public constructor(
    private readonly fur: Material,
    private readonly pink: Material,
  ) {}

  /**
   * Construye el brazo, la muñeca y la mano.
   *
   * @returns Grupo del hombro.
   */
  public build(): Group {
    const { radius, length, spread } = ManekiPaw.ARM;
    const arm = new Mesh(
      new CapsuleGeometry(radius, length, GeometryDetail.Thin, GeometryDetail.Low),
      this.fur,
    );
    arm.position.y = length / 2;
    this.wrist.position.y = length + radius / 2;
    this.buildHand();
    this.group.add(arm, this.wrist);
    this.group.rotation.z = spread;
    return this.group;
  }

  /**
   * Hace el gesto de "ven": la mano se dobla hacia adelante (+z) y vuelve, con el brazo acompañando.
   *
   * @param elapsed Segundos desde el inicio.
   */
  public update(elapsed: number): void {
    const { speed, curl, rest, lean } = ManekiPaw.BECKON;
    const phase = (1 - Math.cos(elapsed * speed)) / 2;
    this.wrist.rotation.x = rest + phase * curl;
    this.group.rotation.x = phase * lean;
  }

  /**
   * Mano redonda con la almohadilla grande y tres deditos rosados al frente.
   */
  private buildHand(): void {
    const { radius, y, scale } = ManekiPaw.HAND;
    const hand = new Mesh(new SphereGeometry(radius, GeometryDetail.Medium, GeometryDetail.Low), this.fur);
    hand.position.y = y;
    hand.scale.set(scale.x, scale.y, scale.z);
    const pad = ManekiPaw.PAD;
    const palm = new Mesh(new SphereGeometry(pad.radius, GeometryDetail.Low, GeometryDetail.Thin), this.pink);
    palm.position.set(0, pad.y, pad.z);
    palm.scale.z = pad.flatten;
    this.wrist.add(hand, palm);
    this.buildBeans();
  }

  /**
   * Tres deditos rosados sobre la almohadilla.
   */
  private buildBeans(): void {
    const bean = ManekiPaw.BEAN;
    ManekiPaw.BEANS.forEach(({ x, y: beanY }) => {
      const toe = new Mesh(
        new SphereGeometry(bean.radius, GeometryDetail.Low, GeometryDetail.Thin),
        this.pink,
      );
      toe.position.set(x, beanY, bean.z);
      toe.scale.z = bean.flatten;
      this.wrist.add(toe);
    });
  }
}
