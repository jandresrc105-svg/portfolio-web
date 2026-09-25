import {
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector2,
  type Vector3Like,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Farol de papel rojo (chōchin) con luz propia, colgado del techo y mecido por el viento.
 */
export class Lantern extends SceneObject implements Updatable, Powerable {
  private static readonly SHAPE = { height: 0.62, radius: 0.24, neck: 0.07, segments: 18 };
  private static readonly CAP = { radius: 0.085, height: 0.05 };
  private static readonly CORD = { radius: 0.006, length: 0.22 };
  private static readonly PAPER = 0xd8282a;
  private static readonly GLOW = 0xff5a26;
  private static readonly EMISSIVE = 2.4;
  private static readonly LIGHT = { intensity: 5.5, distance: 5 };
  private static readonly SWAY = { amplitude: 0.06, speed: 0.9, tilt: 0.7 };
  private static readonly GLYPH_SIDES = { front: 0.25, back: 0.75 };
  private static readonly CANVAS = { width: 512, height: 256, glyphSize: 150 };

  private readonly pivot = new Group();
  private readonly light = new PointLight(Lantern.GLOW, 0, Lantern.LIGHT.distance, 2);
  private readonly paper: MeshStandardMaterial;

  /**
   * Crea el farol.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   * @param anchor Punto de donde cuelga.
   * @param glyph Carácter pintado en el papel.
   * @param phase Desfase del balanceo, para que dos faroles no se muevan igual.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    textures: CanvasTextureFactory,
    private readonly anchor: Vector3Like,
    glyph: string,
    private readonly phase: number,
  ) {
    super();
    const map = this.own(Lantern.paperTexture(textures, glyph));
    this.paper = new MeshStandardMaterial({
      color: Lantern.PAPER,
      map,
      emissive: new Color(Lantern.GLOW),
      emissiveMap: map,
      roughness: 0.7,
    });
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.paper.emissiveIntensity = level * Lantern.EMISSIVE;
    this.light.intensity = level * Lantern.LIGHT.intensity;
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    const { amplitude, speed, tilt } = Lantern.SWAY;
    this.pivot.rotation.z = Math.sin(elapsed * speed + this.phase) * amplitude;
    this.pivot.rotation.x = Math.cos(elapsed * speed * tilt + this.phase) * amplitude * 0.5;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { length, radius } = Lantern.CORD;
    const bodyY = -length - Lantern.SHAPE.height / 2;
    this.pivot.add(
      Lantern.at(new Mesh(new CylinderGeometry(radius, radius, length), this.materials.cable), -length / 2),
    );
    this.pivot.add(Lantern.at(new Mesh(Lantern.bodyGeometry(), this.paper), bodyY));
    this.addCaps(bodyY);
    this.pivot.add(Lantern.at(this.light, bodyY));
    this.add(this.pivot, this.anchor);
    this.setPower(0);
  }

  /**
   * Tapas negras superior e inferior.
   *
   * @param bodyY Altura del centro del cuerpo.
   */
  private addCaps(bodyY: number): void {
    const { radius, height } = Lantern.CAP;
    const offset = Lantern.SHAPE.height / 2;
    [bodyY + offset, bodyY - offset].forEach((y) => {
      this.pivot.add(
        Lantern.at(
          new Mesh(
            new CylinderGeometry(radius, radius, height, GeometryDetail.Medium),
            this.materials.ceramic,
          ),
          y,
        ),
      );
    });
  }

  /**
   * Perfil del farol girado alrededor del eje vertical.
   *
   * @returns Geometría de revolución.
   */
  private static bodyGeometry(): LatheGeometry {
    const { height, radius, neck, segments } = Lantern.SHAPE;
    const profile: Vector2[] = [];
    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      profile.push(new Vector2(neck + (radius - neck) * Math.sin(Math.PI * t), (t - 0.5) * height));
    }
    return new LatheGeometry(profile, segments * 2);
  }

  /**
   * Papel rojo con el carácter repetido a ambos lados del farol.
   *
   * @param textures Fábrica de texturas.
   * @param glyph Carácter.
   * @returns Textura del papel.
   */
  private static paperTexture(
    textures: CanvasTextureFactory,
    glyph: string,
  ): ReturnType<CanvasTextureFactory['paint']> {
    const { width, height, glyphSize } = Lantern.CANVAS;
    return textures.paint(width, height, (context) => {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#1a0a08';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `900 ${String(glyphSize)}px ${CanvasTextureFactory.JAPANESE_FONT}`;
      [width * Lantern.GLYPH_SIDES.front, width * Lantern.GLYPH_SIDES.back].forEach((x) => {
        context.fillText(glyph, x, height / 2);
      });
    });
  }

  /**
   * Coloca un objeto a una altura dentro del pivote.
   *
   * @param object Objeto.
   * @param y Altura.
   * @returns El mismo objeto.
   */
  private static at<T extends Mesh | PointLight>(object: T, y: number): T {
    object.position.y = y;
    return object;
  }
}
