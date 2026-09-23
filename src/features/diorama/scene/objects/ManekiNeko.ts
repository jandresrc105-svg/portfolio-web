import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Vector3Like,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';

/**
 * Gato de la suerte (maneki-neko) en la punta de la barra, saludando sin parar con la pata levantada.
 */
export class ManekiNeko extends SceneObject implements Updatable {
  private static readonly POSITION = { x: 1.95, y: 1.09, z: 0.9 };
  private static readonly ROTATION_Y = -0.35;
  private static readonly CUSHION = { width: 0.2, height: 0.035, depth: 0.18 };
  private static readonly BODY = { radius: 0.075, scaleY: 1.2, y: 0.115 };
  private static readonly HEAD = { radius: 0.068, y: 0.235, z: 0.012 };
  private static readonly EARS = [{ x: -0.042 }, { x: 0.042 }];
  private static readonly EAR = { radius: 0.022, height: 0.04, y: 0.29, tilt: 0.3 };
  private static readonly EYES = [{ x: -0.026 }, { x: 0.026 }];
  private static readonly EYE = { radius: 0.009, y: 0.245, z: 0.07 };
  private static readonly COLLAR = { radius: 0.05, tube: 0.008, y: 0.175, z: 0.01 };
  private static readonly BELL = { radius: 0.014, y: 0.16, z: 0.066 };
  private static readonly COIN = { radius: 0.03, depth: 0.008, x: 0.045, y: 0.1, z: 0.07, stretch: 1.4 };
  private static readonly PAW = { radius: 0.024, length: 0.08, x: -0.062, y: 0.19, z: 0.035, hand: 1.2 };
  private static readonly WAVE = { speed: 3.4, amplitude: 0.45, rest: 0.3 };
  private static readonly COLORS = { fur: 0xf6f1e8, cushion: 0xb01e28, gold: 0xe7b43a, eye: 0x111111 };

  private readonly paw = new Group();

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    const { speed, amplitude, rest } = ManekiNeko.WAVE;
    this.paw.rotation.x = -rest - Math.max(Math.sin(elapsed * speed), 0) * amplitude;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const fur = new MeshStandardMaterial({ color: ManekiNeko.COLORS.fur, roughness: 0.25 });
    const gold = new MeshStandardMaterial({ color: ManekiNeko.COLORS.gold, roughness: 0.2, metalness: 1 });
    const cushion = ManekiNeko.CUSHION;
    this.part(
      new BoxGeometry(cushion.width, cushion.height, cushion.depth),
      new MeshStandardMaterial({ color: ManekiNeko.COLORS.cushion, roughness: 0.7 }),
      { x: 0, y: cushion.height / 2, z: 0 },
    );
    this.buildBody(fur);
    this.buildFace(fur);
    this.buildAccessories(gold);
    this.buildPaw(fur);
    this.root.position.copy(ManekiNeko.POSITION);
    this.root.rotation.y = ManekiNeko.ROTATION_Y;
  }

  /**
   * Cuerpo ovalado y cabeza redonda.
   *
   * @param fur Material del pelaje.
   */
  private buildBody(fur: Material): void {
    const { radius, scaleY, y } = ManekiNeko.BODY;
    const body = this.part(new SphereGeometry(radius, GeometryDetail.High, GeometryDetail.Medium), fur, {
      x: 0,
      y,
      z: 0,
    });
    body.scale.y = scaleY;
    const head = ManekiNeko.HEAD;
    this.part(new SphereGeometry(head.radius, GeometryDetail.High, GeometryDetail.Medium), fur, {
      x: 0,
      y: head.y,
      z: head.z,
    });
  }

  /**
   * Orejas y ojos cerrados de gato contento.
   *
   * @param fur Material del pelaje.
   */
  private buildFace(fur: Material): void {
    const { radius, height, y, tilt } = ManekiNeko.EAR;
    ManekiNeko.EARS.forEach(({ x }) => {
      const ear = this.part(new ConeGeometry(radius, height, GeometryDetail.Thin), fur, { x, y, z: 0 });
      ear.rotation.z = x > 0 ? -tilt : tilt;
    });
    const eye = ManekiNeko.EYE;
    const ink = new MeshStandardMaterial({ color: ManekiNeko.COLORS.eye, roughness: 0.3 });
    ManekiNeko.EYES.forEach(({ x }) => {
      const mesh = this.part(new SphereGeometry(eye.radius, GeometryDetail.Low, GeometryDetail.Thin), ink, {
        x,
        y: eye.y,
        z: eye.z,
      });
      mesh.scale.y = 0.35;
    });
  }

  /**
   * Collar rojo, cascabel y moneda koban dorada.
   *
   * @param gold Material dorado.
   */
  private buildAccessories(gold: Material): void {
    const { radius, tube, y, z } = ManekiNeko.COLLAR;
    const collar = this.part(
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.High),
      new MeshStandardMaterial({ color: ManekiNeko.COLORS.cushion, roughness: 0.4 }),
      { x: 0, y, z },
    );
    collar.rotation.x = Math.PI / 2;
    this.buildCharms(gold);
  }

  /**
   * Cascabel del collar y moneda koban entre las patas.
   *
   * @param gold Material dorado.
   */
  private buildCharms(gold: Material): void {
    const bell = ManekiNeko.BELL;
    this.part(new SphereGeometry(bell.radius, GeometryDetail.Low, GeometryDetail.Low), gold, {
      x: 0,
      y: bell.y,
      z: bell.z,
    });
    const coin = ManekiNeko.COIN;
    const koban = this.part(
      new CylinderGeometry(coin.radius, coin.radius, coin.depth, GeometryDetail.Medium),
      gold,
      coin,
    );
    koban.rotation.x = Math.PI / 2;
    koban.scale.z = coin.stretch;
  }

  /**
   * Pata levantada que saluda, articulada en el hombro.
   *
   * @param fur Material del pelaje.
   */
  private buildPaw(fur: Material): void {
    const { radius, length, x, y, z, hand: handScale } = ManekiNeko.PAW;
    const arm = new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.Low), fur);
    arm.position.y = length / 2;
    const hand = new Mesh(
      new SphereGeometry(radius * handScale, GeometryDetail.Low, GeometryDetail.Thin),
      fur,
    );
    hand.position.y = length;
    this.paw.add(arm, hand);
    this.add(this.paw, { x, y, z });
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
    return this.add(new Mesh(geometry, material), position);
  }
}
