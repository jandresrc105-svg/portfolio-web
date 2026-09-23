import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Vector3Like,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import { ManekiPaw } from './ManekiPaw';

/**
 * Gato de la suerte (maneki-neko) de cerámica en la punta de la barra, sentado sobre su cojín rojo: cabeza
 * grande con ojos felices cerrados, boca en "ω", mejillas rosadas, bigotes y manchas calicó; collar rojo con
 * cascabel, una pata sosteniendo la moneda koban "千万両", cola enroscada y la otra pata levantada llamando a
 * la clientela (ver {@link ManekiPaw}). Medidas en metros, +z al frente del gato y +x a su izquierda.
 */
export class ManekiNeko extends SceneObject implements Updatable {
  private static readonly POSITION = { x: 1.95, y: 1.09, z: 0.9 };
  private static readonly ROTATION_Y = -0.35;
  private static readonly COLORS = {
    fur: 0xfbf7ef,
    pink: 0xf2a0b4,
    orange: 0xe8893a,
    black: 0x1c1a1a,
    red: 0xb01e28,
    gold: 0xe7b43a,
  };
  private static readonly CUSHION = { width: 0.2, height: 0.035, depth: 0.18 };
  private static readonly TASSEL = { radius: 0.009, x: 0.1, z: 0.09 };
  private static readonly CORNERS = [
    { x: -1, z: -1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: 1, z: 1 },
  ];
  private static readonly BODY = { radius: 0.078, y: 0.12, scale: { x: 1, y: 1.15, z: 0.92 } };
  private static readonly HEAD = { radius: 0.078, y: 0.25, z: 0.012, scale: { x: 1.12, y: 0.92, z: 0.95 } };
  private static readonly EARS = [{ side: -1 }, { side: 1 }];
  private static readonly EAR = { radius: 0.024, height: 0.045, x: 0.05, y: 0.325, tilt: 0.38 };
  private static readonly INNER_EAR = { radius: 0.015, height: 0.03, lift: 0.004, z: 0.008 };
  private static readonly EYE = { radius: 0.012, tube: 0.0026, x: 0.03, y: 0.258, z: 0.08, turn: 0.35 };
  private static readonly NOSE = { radius: 0.007, y: 0.241, z: 0.085, flatten: 0.6 };
  private static readonly MOUTH = { radius: 0.0065, tube: 0.0018, x: 0.0065, y: 0.23, z: 0.082 };
  private static readonly CHEEK = { radius: 0.012, x: 0.05, y: 0.235, z: 0.07, flatten: 0.3, turn: 0.6 };
  private static readonly WHISKERS = [
    { y: 0.243, tilt: 0.14 },
    { y: 0.236, tilt: 0 },
    { y: 0.229, tilt: -0.14 },
  ];
  private static readonly WHISKER = { length: 0.045, thickness: 0.0014, x: 0.085, z: 0.05, turn: 0.5 };
  private static readonly PATCHES = [
    { color: 'orange', radius: 0.032, x: -0.045, y: 0.3, z: 0, flatten: 0.5 },
    { color: 'black', radius: 0.022, x: 0.052, y: 0.298, z: -0.02, flatten: 0.5 },
    { color: 'black', radius: 0.035, x: 0.035, y: 0.14, z: -0.05, flatten: 0.5 },
  ] as const;
  private static readonly COLLAR = { radius: 0.057, tube: 0.009, y: 0.182 };
  private static readonly BELL = { radius: 0.016, y: 0.168, z: 0.066, slit: { width: 0.018, height: 0.002 } };
  private static readonly COIN = { radius: 0.025, depth: 0.007, x: -0.01, y: 0.105, z: 0.078, stretch: 1.35 };
  private static readonly COIN_TILT = -0.15;
  private static readonly COIN_ART = {
    size: 64,
    face: '#e7b43a',
    ink: '#6e4510',
    rim: 3,
    glyphs: [
      { text: '千', y: 0.26 },
      { text: '万', y: 0.5 },
      { text: '両', y: 0.74 },
    ],
    font: 15,
  };
  private static readonly HOLDING_PAW = { radius: 0.02, x: -0.04, y: 0.1, z: 0.074, flatten: 0.8 };
  private static readonly FEET = { radius: 0.022, x: 0.038, y: 0.043, z: 0.06, flatten: 0.6 };
  private static readonly TAIL = {
    radius: 0.011,
    points: [
      { x: -0.02, y: 0.045, z: -0.065 },
      { x: -0.065, y: 0.05, z: -0.055 },
      { x: -0.085, y: 0.085, z: -0.03 },
      { x: -0.075, y: 0.12, z: -0.02 },
    ],
  };
  private static readonly SHOULDER = { x: 0.058, y: 0.178, z: 0.025 };

  private readonly fur = new MeshStandardMaterial({ color: ManekiNeko.COLORS.fur, roughness: 0.22 });
  private readonly pink = new MeshStandardMaterial({ color: ManekiNeko.COLORS.pink, roughness: 0.4 });
  private readonly gold = new MeshStandardMaterial({
    color: ManekiNeko.COLORS.gold,
    roughness: 0.2,
    metalness: 1,
  });
  private readonly paw = new ManekiPaw(this.fur, this.pink);

  /**
   * Crea el gato.
   *
   * @param textures Fábrica de texturas (para la moneda koban).
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    super();
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    this.paw.update(elapsed);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildCushion();
    this.buildBody();
    this.buildFace();
    this.buildMarkings();
    this.buildCollar();
    this.buildCoin();
    this.buildTail();
    const shoulder = this.paw.build();
    this.add(shoulder, ManekiNeko.SHOULDER);
    this.root.position.copy(ManekiNeko.POSITION);
    this.root.rotation.y = ManekiNeko.ROTATION_Y;
    this.settle(shoulder);
  }

  /**
   * Cojín rojo con borlas doradas en las esquinas.
   */
  private buildCushion(): void {
    const { width, height, depth } = ManekiNeko.CUSHION;
    const cloth = new MeshStandardMaterial({ color: ManekiNeko.COLORS.red, roughness: 0.75 });
    this.part(new BoxGeometry(width, height, depth), cloth, { x: 0, y: height / 2, z: 0 });
    const tassel = ManekiNeko.TASSEL;
    ManekiNeko.CORNERS.forEach(({ x, z }) => {
      const position = { x: x * tassel.x, y: height, z: z * tassel.z };
      this.part(
        new SphereGeometry(tassel.radius, GeometryDetail.Low, GeometryDetail.Thin),
        this.gold,
        position,
      );
    });
  }

  /**
   * Cuerpo sentado en forma de pera, cabeza grande, patas traseras al frente y la pata que sostiene la moneda.
   */
  private buildBody(): void {
    const body = ManekiNeko.BODY;
    this.oval(body.radius, { x: 0, y: body.y, z: 0 }, body.scale, this.fur);
    const head = ManekiNeko.HEAD;
    this.oval(head.radius, { x: 0, y: head.y, z: head.z }, head.scale, this.fur);
    const feet = ManekiNeko.FEET;
    [-1, 1].forEach((side) => {
      this.oval(
        feet.radius,
        { x: side * feet.x, y: feet.y, z: feet.z },
        { x: 1, y: feet.flatten, z: 1 },
        this.fur,
      );
    });
    const holding = ManekiNeko.HOLDING_PAW;
    this.oval(holding.radius, holding, { x: 1, y: 1, z: holding.flatten }, this.fur);
  }

  /**
   * Orejas con su interior rosado, ojos felices cerrados, nariz, boca en "ω" y mejillas.
   */
  private buildFace(): void {
    const { radius, height, x, y, tilt } = ManekiNeko.EAR;
    const inner = ManekiNeko.INNER_EAR;
    ManekiNeko.EARS.forEach(({ side }) => {
      const ear = this.part(new ConeGeometry(radius, height, GeometryDetail.Low), this.fur, {
        x: side * x,
        y,
        z: 0,
      });
      ear.rotation.z = -side * tilt;
      const cone = new ConeGeometry(inner.radius, inner.height, GeometryDetail.Low);
      const pink = this.part(cone, this.pink, { x: side * x, y: y - inner.lift, z: inner.z });
      pink.rotation.z = -side * tilt;
    });
    this.buildEyes();
    const nose = ManekiNeko.NOSE;
    this.oval(nose.radius, { x: 0, y: nose.y, z: nose.z }, { x: 1, y: nose.flatten, z: 1 }, this.pink);
    this.buildMouth();
    this.buildWhiskers();
  }

  /**
   * Ojos cerrados en arco (∩ ∩) de gato contento y mejillas rosadas, girados según la curva de la cara.
   */
  private buildEyes(): void {
    const ink = new MeshStandardMaterial({ color: ManekiNeko.COLORS.black, roughness: 0.3 });
    const eye = ManekiNeko.EYE;
    [-1, 1].forEach((side) => {
      const arc = new TorusGeometry(
        eye.radius,
        eye.tube,
        GeometryDetail.Thin,
        GeometryDetail.Medium,
        Math.PI,
      );
      const mesh = this.part(arc, ink, { x: side * eye.x, y: eye.y, z: eye.z });
      mesh.rotation.y = side * eye.turn;
      this.buildCheek(side);
    });
  }

  /**
   * Mejilla rosada de un lado de la cara.
   *
   * @param side -1 a la derecha del gato, 1 a su izquierda.
   */
  private buildCheek(side: number): void {
    const cheek = ManekiNeko.CHEEK;
    const blush = this.oval(
      cheek.radius,
      { x: side * cheek.x, y: cheek.y, z: cheek.z },
      { x: 1, y: 1, z: cheek.flatten },
      this.pink,
    );
    blush.rotation.y = side * cheek.turn;
  }

  /**
   * Boca en "ω": dos arcos pequeños unidos bajo la nariz.
   */
  private buildMouth(): void {
    const ink = new MeshStandardMaterial({ color: ManekiNeko.COLORS.black, roughness: 0.3 });
    const { radius, tube, x, y, z } = ManekiNeko.MOUTH;
    [-1, 1].forEach((side) => {
      const arc = new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Low, Math.PI);
      const mesh = this.part(arc, ink, { x: side * x, y, z });
      mesh.rotation.z = Math.PI;
    });
  }

  /**
   * Tres bigotes finos a cada lado de la cara.
   */
  private buildWhiskers(): void {
    const ink = new MeshStandardMaterial({ color: ManekiNeko.COLORS.black, roughness: 0.5 });
    const { length, thickness, x, z, turn } = ManekiNeko.WHISKER;
    [-1, 1].forEach((side) => {
      ManekiNeko.WHISKERS.forEach(({ y, tilt }) => {
        const whisker = this.part(new BoxGeometry(length, thickness, thickness), ink, { x: side * x, y, z });
        whisker.rotation.set(0, side * turn, side * tilt);
      });
    });
  }

  /**
   * Manchas calicó: naranja y negra en la cabeza, negra en la espalda.
   */
  private buildMarkings(): void {
    const colors = {
      orange: new MeshStandardMaterial({ color: ManekiNeko.COLORS.orange, roughness: 0.25 }),
      black: new MeshStandardMaterial({ color: ManekiNeko.COLORS.black, roughness: 0.25 }),
    };
    ManekiNeko.PATCHES.forEach(({ color, radius, x, y, z, flatten }) => {
      this.oval(radius, { x, y, z }, { x: 1, y: flatten, z: 1 }, colors[color]);
    });
  }

  /**
   * Collar rojo con cascabel dorado.
   */
  private buildCollar(): void {
    const { radius, tube, y } = ManekiNeko.COLLAR;
    const ribbon = new MeshStandardMaterial({ color: ManekiNeko.COLORS.red, roughness: 0.4 });
    const collar = this.part(
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.High),
      ribbon,
      {
        x: 0,
        y,
        z: 0,
      },
    );
    collar.rotation.x = Math.PI / 2;
    this.buildBell();
  }

  /**
   * Cascabel dorado con su ranura negra.
   */
  private buildBell(): void {
    const bell = ManekiNeko.BELL;
    this.part(new SphereGeometry(bell.radius, GeometryDetail.Medium, GeometryDetail.Low), this.gold, {
      x: 0,
      y: bell.y,
      z: bell.z,
    });
    const ink = new MeshStandardMaterial({ color: ManekiNeko.COLORS.black, roughness: 0.5 });
    const slit = bell.slit;
    this.part(new BoxGeometry(slit.width, slit.height, slit.height), ink, {
      x: 0,
      y: bell.y - bell.radius / 2,
      z: bell.z + bell.radius * (Math.SQRT2 / 2),
    });
  }

  /**
   * Moneda koban ovalada con "千万両" escrito en vertical, sostenida contra la barriga.
   */
  private buildCoin(): void {
    const { radius, depth, x, y, z, stretch } = ManekiNeko.COIN;
    const coin = this.part(new CylinderGeometry(radius, radius, depth, GeometryDetail.Medium), this.gold, {
      x,
      y,
      z,
    });
    coin.rotation.x = Math.PI / 2 + ManekiNeko.COIN_TILT;
    coin.scale.z = stretch;
    const face = new MeshStandardMaterial({ map: this.own(this.coinArt()), roughness: 0.3, metalness: 0.6 });
    const front = this.part(new CircleGeometry(radius, GeometryDetail.Medium), face, {
      x,
      y,
      z: z + (depth / 2) * Math.cos(ManekiNeko.COIN_TILT),
    });
    front.rotation.x = ManekiNeko.COIN_TILT;
    front.scale.y = stretch;
  }

  /**
   * Cara de la moneda: dorado con borde y los tres caracteres en tinta oscura.
   *
   * @returns Textura de la moneda.
   */
  private coinArt(): ReturnType<CanvasTextureFactory['paint']> {
    const { size, face, ink, rim, glyphs, font } = ManekiNeko.COIN_ART;
    return this.textures.paint(size, size, (context) => {
      context.fillStyle = face;
      context.fillRect(0, 0, size, size);
      context.strokeStyle = ink;
      context.lineWidth = rim;
      context.beginPath();
      context.arc(size / 2, size / 2, size / 2 - rim * 2, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = ink;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `900 ${String(font)}px ${CanvasTextureFactory.JAPANESE_FONT}`;
      glyphs.forEach(({ text, y }) => {
        context.fillText(text, size / 2, size * y);
      });
    });
  }

  /**
   * Cola enroscada que asoma por un costado.
   */
  private buildTail(): void {
    const { radius, points } = ManekiNeko.TAIL;
    const curve = new CatmullRomCurve3(points.map(({ x, y, z }) => new Vector3(x, y, z)));
    this.part(new TubeGeometry(curve, GeometryDetail.Medium, radius, GeometryDetail.Low), this.fur, {
      x: 0,
      y: 0,
      z: 0,
    });
  }

  /**
   * Agrega una esfera deformada (cuerpo, cabeza, patas, manchas).
   *
   * @param radius Radio.
   * @param position Posición.
   * @param scale Escala en cada eje.
   * @param material Material.
   * @returns Malla creada.
   */
  private oval(radius: number, position: Vector3Like, scale: Vector3Like, material: Material): Mesh {
    const mesh = this.part(
      new SphereGeometry(radius, GeometryDetail.High, GeometryDetail.Medium),
      material,
      position,
    );
    mesh.scale.set(scale.x, scale.y, scale.z);
    return mesh;
  }

  /**
   * Agrega una pieza.
   *
   * @param geometry Geometría.
   * @param material Material.
   * @param position Posición.
   * @returns Malla creada.
   */
  private part(geometry: BufferGeometry, material: Material, position: Vector3Like): Mesh {
    return this.add(new Mesh(geometry, material), { x: position.x, y: position.y, z: position.z });
  }
}
