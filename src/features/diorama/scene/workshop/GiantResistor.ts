import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { ResistorCode } from '../../models/ResistorCode';
import type { OhmDisplays } from './OhmDisplays';

/**
 * Resistencia axial gigante de muestra sobre un soporte: cuerpo color crema con los extremos abultados,
 * patas de alambre y las 4 bandas de color del valor elegido en la década (llevado al valor normalizado E24),
 * más una placa con el valor. Si la resistencia del circuito disipa más de ¼ W, el cuerpo se pone al rojo.
 * Se construye en un grupo con origen en el centro de la base del soporte; el eje de la resistencia va en x.
 */
export class GiantResistor {
  private static readonly STAND = { width: 0.25, height: 0.012, depth: 0.07, color: 0x3a2a1f };
  private static readonly POSTS = [{ x: -0.11 }, { x: 0.11 }];
  private static readonly POST = { radius: 0.0035, color: 0xb9bec4 };
  private static readonly AXIS = { y: 0.1 };
  private static readonly BODY = { radius: 0.02, length: 0.1, color: 0xd7bf93 };
  private static readonly CAPS = [{ x: -0.058 }, { x: 0.058 }];
  private static readonly CAP = { radius: 0.024, squash: 0.8 };
  private static readonly LEAD = { radius: 0.0025, reach: 0.11 };
  private static readonly BANDS = [{ x: -0.03 }, { x: -0.016 }, { x: -0.002 }, { x: 0.026 }];
  private static readonly SINGLE = { x: 0 };
  private static readonly BAND = { radius: 0.0206, width: 0.009, roughness: 0.5, metallic: 0.25 };
  private static readonly PLAQUE = { width: 0.09, height: 0.0225, tilt: 0.9, z: 0.03, glow: 0.8, off: 0.05 };
  private static readonly HIT = { width: 0.24, height: 0.06, depth: 0.06 };
  private static readonly HEAT = { color: 0xff5a1a, strength: 1.4, rate: 2 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.3 };

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new BoxGeometry(GiantResistor.HIT.width, GiantResistor.HIT.height, GiantResistor.HIT.depth),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly body = new MeshStandardMaterial({ roughness: 0.55, metalness: 0, envMapIntensity: 0.3 });
  private readonly bands: { mesh: Mesh; material: MeshStandardMaterial }[] = [];
  private readonly plaque = new MeshBasicMaterial();
  private shown = '';
  private heat = 0;
  private heatTarget = 0;
  private highlighted = false;

  /**
   * Crea la resistencia.
   *
   * @param displays Pintor de la placa.
   */
  public constructor(private readonly displays: OhmDisplays) {}

  /**
   * Construye el soporte, la resistencia, sus bandas y la placa.
   *
   * @returns Grupo de la resistencia.
   */
  public build(): Group {
    this.buildStand();
    this.buildBody();
    [...GiantResistor.BANDS, GiantResistor.SINGLE].forEach(({ x }) => {
      this.buildBand(x);
    });
    this.buildPlaque();
    this.hitArea.position.y = GiantResistor.AXIS.y;
    this.group.add(this.hitArea);
    return this.group;
  }

  /**
   * Pinta las bandas y la placa (solo si cambió el valor) y fija cuánto se calienta.
   *
   * @param code Código de colores.
   * @param label Texto de la placa.
   * @param heat Exceso de potencia sobre ¼ W (0 = frío, 1 = al rojo).
   * @param level Brillo general (encendido de la escena).
   */
  public show(code: ResistorCode, label: string, heat: number, level: number): void {
    this.heatTarget = heat;
    const { glow, off } = GiantResistor.PLAQUE;
    this.plaque.color.setScalar(Math.max(level * glow, off));
    if (label === this.shown) {
      return;
    }
    this.shown = label;
    this.paintBands(code);
    this.plaque.map?.dispose();
    this.plaque.map = this.displays.plaque(label);
    this.plaque.needsUpdate = true;
  }

  /**
   * Calienta o enfría el cuerpo poco a poco.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    const { color, strength, rate } = GiantResistor.HEAT;
    this.heat += (this.heatTarget - this.heat) * (1 - Math.exp(-rate * delta));
    if (this.highlighted) {
      const light = GiantResistor.HIGHLIGHT;
      this.body.emissive.set(light.color).multiplyScalar(light.strength);
      return;
    }
    this.body.emissive.set(color).multiplyScalar(this.heat * strength);
  }

  /**
   * Resalta la resistencia señalada.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    this.highlighted = active;
  }

  /**
   * Libera la textura de la placa.
   */
  public dispose(): void {
    this.plaque.map?.dispose();
  }

  /**
   * Base de madera y los dos postes que sostienen las patas.
   */
  private buildStand(): void {
    const { width, height, depth, color } = GiantResistor.STAND;
    const base = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial({ color, roughness: 0.7, envMapIntensity: 0.3 }),
    );
    base.position.y = height / 2;
    const post = GiantResistor.POST;
    const metal = new MeshStandardMaterial({ color: post.color, roughness: 0.3, metalness: 0.9 });
    const tall = GiantResistor.AXIS.y - height;
    GiantResistor.POSTS.forEach(({ x }) => {
      const rod = new Mesh(new CylinderGeometry(post.radius, post.radius, tall, GeometryDetail.Thin), metal);
      rod.position.set(x, height + tall / 2, 0);
      this.group.add(rod);
    });
    this.group.add(base, this.lead(metal));
  }

  /**
   * Alambre de las patas, de poste a poste, que atraviesa la resistencia.
   *
   * @param metal Material del alambre.
   * @returns Malla del alambre.
   */
  private lead(metal: MeshStandardMaterial): Mesh {
    const lead = GiantResistor.LEAD;
    const wire = new Mesh(
      new CylinderGeometry(lead.radius, lead.radius, lead.reach * 2, GeometryDetail.Thin),
      metal,
    );
    wire.rotation.z = Math.PI / 2;
    wire.position.y = GiantResistor.AXIS.y;
    return wire;
  }

  /**
   * Cuerpo cilíndrico con los extremos abultados.
   */
  private buildBody(): void {
    const { radius, length, color } = GiantResistor.BODY;
    this.body.color.set(color);
    const core = new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.High), this.body);
    core.rotation.z = Math.PI / 2;
    core.position.y = GiantResistor.AXIS.y;
    const cap = GiantResistor.CAP;
    const geometry = new SphereGeometry(cap.radius, GeometryDetail.High, GeometryDetail.Medium);
    GiantResistor.CAPS.forEach(({ x }) => {
      const end = new Mesh(geometry, this.body);
      end.scale.set(cap.squash, 1, 1);
      end.position.set(x, GiantResistor.AXIS.y, 0);
      this.group.add(end);
    });
    this.group.add(core);
  }

  /**
   * Banda de color alrededor del cuerpo.
   *
   * @param x Posición a lo largo del eje.
   */
  private buildBand(x: number): void {
    const { radius, width } = GiantResistor.BAND;
    const material = new MeshStandardMaterial({ roughness: 0.5 });
    const mesh = new Mesh(new CylinderGeometry(radius, radius, width, GeometryDetail.High), material);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, GiantResistor.AXIS.y, 0);
    this.bands.push({ mesh, material });
    this.group.add(mesh);
  }

  /**
   * Placa inclinada al frente de la base.
   */
  private buildPlaque(): void {
    const { width, height, tilt, z } = GiantResistor.PLAQUE;
    const plate = new Mesh(new PlaneGeometry(width, height), this.plaque);
    plate.rotation.x = -tilt;
    plate.position.set(0, GiantResistor.STAND.height + height / 2, z);
    this.group.add(plate);
  }

  /**
   * Pinta las 4 bandas (o solo la negra del centro para 0 Ω).
   *
   * @param code Código de colores.
   */
  private paintBands(code: ResistorCode): void {
    const single = code.bands.length === 1;
    const lastIndex = this.bands.length - 1;
    this.bands.forEach(({ mesh, material }, index) => {
      const band = single ? code.bands[0] : code.bands[index];
      const visible = single ? index === lastIndex : index < lastIndex && band !== undefined;
      mesh.visible = visible;
      if (band && visible) {
        material.color.set(band.color);
        material.metalness = band.metallic ? 1 : 0;
        material.roughness = band.metallic ? GiantResistor.BAND.metallic : GiantResistor.BAND.roughness;
      }
    });
  }
}
