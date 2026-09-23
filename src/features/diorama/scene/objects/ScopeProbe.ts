import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Sonda del osciloscopio: cable negro desde el conector BNC de CH1 que cae a la barra y serpentea hasta el
 * cuerpo de la sonda (con la banda amarilla de CH1), apoyado sobre la barra, con la punta de gancho en el
 * punto de prueba y el cable de tierra con su pinza en GND. Las posiciones van en el espacio de la placa
 * (y = 0 es la superficie de la barra); el cuerpo se apoya sobre la placa.
 */
export class ScopeProbe {
  private static readonly CABLE = { radius: 0.0021, color: 0x17181b, sag: 0.35, sway: 0.05 };
  private static readonly PLUG = { radius: 0.0062, length: 0.016, boot: 0.012, bootRadius: 0.004 };
  private static readonly BODY = { radius: 0.0048, length: 0.055, color: 0x16171a };
  private static readonly BAND = { color: 0xffe14a, width: 0.004, from: 0.008, grow: 1.08 };
  private static readonly TIP = { radius: 0.0009, length: 0.012, lift: 0.002 };
  private static readonly HOOK = { radius: 0.0016, tube: 0.00035 };
  private static readonly GROUND = { radius: 0.0008, arc: 0.018, color: 0x101012 };
  private static readonly CLIP = { width: 0.0035, height: 0.003, length: 0.01 };
  private static readonly ROUTE = [
    { along: 0.12, height: 0.5, side: 0 },
    { along: 0.35, height: 0, side: 1 },
    { along: 0.7, height: 0, side: -0.5 },
  ];
  private static readonly UP = new Vector3(0, 1, 0);

  public readonly group = new Group();

  private readonly rubber: MeshStandardMaterial;
  private readonly metal = new MeshStandardMaterial({ color: 0xc7ccd3, roughness: 0.3, metalness: 0.85 });

  /**
   * Arma la sonda.
   *
   * @param from Punta del conector BNC de CH1.
   * @param to Punto de prueba donde se engancha la punta.
   * @param ground Punto de tierra donde muerde la pinza.
   * @param rest Altura de la superficie donde se apoya el cuerpo de la sonda.
   */
  public constructor(from: Vector3, to: Vector3, ground: Vector3, rest: number) {
    this.rubber = new MeshStandardMaterial({ color: ScopeProbe.CABLE.color, roughness: 0.55 });
    const heading = new Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    const tipBase = to.clone().addScaledVector(heading, -ScopeProbe.TIP.length);
    tipBase.y = rest + ScopeProbe.BODY.radius + ScopeProbe.TIP.lift;
    const rear = tipBase.clone().addScaledVector(heading, -ScopeProbe.BODY.length);
    rear.y = rest + ScopeProbe.BODY.radius;
    this.buildCable(from, to, rear);
    this.buildBody(rear, tipBase, heading);
    this.buildTip(tipBase, to);
    this.buildGround(tipBase, ground);
  }

  /**
   * Cable desde el BNC: sale del conector, cae a la barra y llega al cuerpo de la sonda.
   *
   * @param from Punta del BNC.
   * @param to Punto de prueba (para orientar el recorrido).
   * @param rear Parte trasera del cuerpo de la sonda.
   */
  private buildCable(from: Vector3, to: Vector3, rear: Vector3): void {
    const { radius, sag, sway } = ScopeProbe.CABLE;
    const side = new Vector3(to.z - from.z, 0, from.x - to.x).normalize().multiplyScalar(sway);
    const points = [
      from,
      ...ScopeProbe.ROUTE.map(({ along, height, side: offset }) => {
        const point = from.clone().lerp(to, along).addScaledVector(side, offset);
        point.y = radius + from.y * height * sag;
        return point;
      }),
      rear,
    ];
    const curve = new CatmullRomCurve3(points);
    this.group.add(
      new Mesh(new TubeGeometry(curve, GeometryDetail.Ring, radius, GeometryDetail.Thin), this.rubber),
    );
    this.buildPlug(from, points[1] ?? from);
  }

  /**
   * Conector BNC macho y su funda de goma, alineados con la salida del cable.
   *
   * @param from Punta del BNC del osciloscopio.
   * @param next Siguiente punto del cable (marca hacia dónde sale).
   */
  private buildPlug(from: Vector3, next: Vector3): void {
    const { radius, length, boot, bootRadius } = ScopeProbe.PLUG;
    const outward = next.clone().sub(from).normalize();
    const joint = from.clone().addScaledVector(outward, length);
    this.group.add(this.rod(from, joint, radius, this.metal));
    this.group.add(this.rod(joint, joint.clone().addScaledVector(outward, boot), bootRadius, this.rubber));
  }

  /**
   * Cuerpo de la sonda con la banda amarilla de CH1.
   *
   * @param rear Extremo trasero.
   * @param front Extremo delantero (base de la punta).
   * @param heading Dirección horizontal hacia la punta.
   */
  private buildBody(rear: Vector3, front: Vector3, heading: Vector3): void {
    const { radius, color } = ScopeProbe.BODY;
    const plastic = new MeshStandardMaterial({ color, roughness: 0.45 });
    this.group.add(this.rod(rear, front, radius, plastic));
    const { width, from } = ScopeProbe.BAND;
    const start = rear.clone().addScaledVector(heading, from);
    const band = new MeshStandardMaterial({ color: ScopeProbe.BAND.color, roughness: 0.5 });
    this.group.add(
      this.rod(start, start.clone().addScaledVector(heading, width), radius * ScopeProbe.BAND.grow, band),
    );
  }

  /**
   * Punta metálica con gancho en el punto de prueba.
   *
   * @param base Base de la punta.
   * @param point Punto de prueba.
   */
  private buildTip(base: Vector3, point: Vector3): void {
    this.group.add(this.rod(base, point, ScopeProbe.TIP.radius, this.metal));
    const { radius, tube } = ScopeProbe.HOOK;
    const hook = new Mesh(
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Medium),
      this.metal,
    );
    hook.position.copy(point);
    this.group.add(hook);
  }

  /**
   * Cable de tierra en arco desde la sonda hasta la pinza sobre GND.
   *
   * @param start Punto de salida en la sonda.
   * @param ground Punto de tierra.
   */
  private buildGround(start: Vector3, ground: Vector3): void {
    const { radius, arc, color } = ScopeProbe.GROUND;
    const middle = start.clone().lerp(ground, 1 / 2);
    middle.y += arc;
    const lead = new TubeGeometry(
      new CatmullRomCurve3([start, middle, ground]),
      GeometryDetail.Curve,
      radius,
      GeometryDetail.Wire,
    );
    const insulation = new MeshStandardMaterial({ color, roughness: 0.6 });
    this.group.add(new Mesh(lead, insulation));
    const { width, height, length } = ScopeProbe.CLIP;
    const clip = new Mesh(new BoxGeometry(width, height, length), insulation);
    clip.position.copy(ground);
    this.group.add(clip);
  }

  /**
   * Cilindro entre dos puntos.
   *
   * @param start Extremo inicial.
   * @param end Extremo final.
   * @param radius Radio.
   * @param material Material.
   * @returns Malla orientada.
   */
  private rod(start: Vector3, end: Vector3, radius: number, material: Material): Mesh {
    const direction = end.clone().sub(start);
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, direction.length(), GeometryDetail.Medium),
      material,
    );
    mesh.quaternion.copy(new Quaternion().setFromUnitVectors(ScopeProbe.UP, direction.normalize()));
    mesh.position.copy(start).lerp(end, 1 / 2);
    return mesh;
  }
}
