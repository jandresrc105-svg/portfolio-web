import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { BoardPart } from '../../models/BoardPart';

/**
 * Fábrica de componentes electrónicos en 3D (patrón Strategy por tipo de encapsulado): cada uno se arma
 * con sus proporciones reales (cuerpo de epoxi, patas estañadas, latas, conectores) y se apoya sobre la
 * cara superior de la placa (y = 0), centrado en su posición. Las patas de un chip se unen en una sola
 * geometría para ahorrar llamadas de dibujo.
 */
export class ElectronicParts {
  private static readonly EPOXY = { color: 0x121316, roughness: 0.55 };
  private static readonly TIN = { color: 0xc9ccd1, roughness: 0.35, metalness: 0.8 };
  private static readonly GOLD = { color: 0xd8b25a, roughness: 0.3, metalness: 0.9 };
  private static readonly CAN = { color: 0xb9bec6, roughness: 0.3, metalness: 0.85 };
  private static readonly SLEEVE = { color: 0x1c2b57, roughness: 0.4 };
  private static readonly TERMINAL = { color: 0x1f7a4a, roughness: 0.6 };
  private static readonly CERAMIC = { color: 0xa98356, roughness: 0.6 };
  private static readonly CHIP = { height: 0.0016, lift: 0.0003 };
  private static readonly PIN = { width: 0.0003, height: 0.0003, reach: 0.0014, pitch: 0.0013 };
  private static readonly QFP_PINS = 10;
  private static readonly SOIC_PINS = 4;
  private static readonly SOT = { tab: 0.4, pins: 3 };
  private static readonly CRYSTAL = { height: 0.0035, radius: 0.0015 };
  private static readonly CAPACITOR = { height: 0.009, stripe: 0.18, top: 0.0003 };
  private static readonly HEADER = {
    height: 0.0025,
    pin: 0.00064,
    pinHeight: 0.0085,
    pitch: 0.00254,
    columns: 8,
    rows: 2,
  };
  private static readonly USB = { height: 0.0032, radius: 0.0012 };
  private static readonly TERMINAL_BLOCK = { height: 0.009, screw: 0.0016, screws: 2, hole: 0.0022 };
  private static readonly PASSIVE = { height: 0.0008, cap: 0.22, capHeight: 1.05 };
  private static readonly TEST_POINT = { radius: 0.0012, tube: 0.00028, height: 0.003 };
  private static readonly MARK = { radius: 0.0008, inset: 0.0022, color: 0x3a3c42 };

  private readonly epoxy = new MeshStandardMaterial(ElectronicParts.EPOXY);
  private readonly tin = new MeshStandardMaterial(ElectronicParts.TIN);
  private readonly gold = new MeshStandardMaterial(ElectronicParts.GOLD);
  private readonly can = new MeshStandardMaterial(ElectronicParts.CAN);
  private readonly sleeve = new MeshStandardMaterial(ElectronicParts.SLEEVE);
  private readonly terminal = new MeshStandardMaterial(ElectronicParts.TERMINAL);
  private readonly ceramic = new MeshStandardMaterial(ElectronicParts.CERAMIC);
  private readonly builders: Readonly<
    Record<Exclude<BoardPart['kind'], 'led'>, (part: BoardPart) => Object3D>
  > = {
    qfp: (part) => this.qfp(part),
    soic: (part) => this.soic(part),
    sot: (part) => this.sot(part),
    crystal: (part) => this.crystal(part),
    capacitor: (part) => this.capacitor(part),
    header: (part) => this.header(part),
    usb: (part) => this.usb(part),
    terminal: (part) => this.terminalBlock(part),
    passive: (part) => this.passive(part),
    testpoint: () => this.testPoint(),
  };

  /**
   * Arma un componente y lo ubica sobre la placa.
   *
   * @param part Componente.
   * @param led Material iluminado para los LEDs (los demás tipos lo ignoran).
   * @returns Pieza 3D.
   */
  public build(part: BoardPart, led: Material): Object3D {
    const piece = part.kind === 'led' ? this.led(part, led) : this.builders[part.kind](part);
    piece.position.set(part.x, piece.position.y, part.z);
    return piece;
  }

  /**
   * Microcontrolador en encapsulado QFP: cuerpo cuadrado, patas en los cuatro lados y marca del pin 1.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private qfp(part: BoardPart): Group {
    const group = this.chipBody(part.width, part.depth);
    const pins = [0, 1, 2, 3].flatMap((side) => ElectronicParts.pinRow(part, side, ElectronicParts.QFP_PINS));
    group.add(this.merged(pins, this.tin));
    const { radius, inset, color } = ElectronicParts.MARK;
    const mark = new Mesh(
      new CylinderGeometry(radius, radius, ElectronicParts.PIN.height, GeometryDetail.Low),
      new MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    const { height, lift } = ElectronicParts.CHIP;
    mark.position.set(-part.width / 2 + inset, height + lift, part.depth / 2 - inset);
    group.add(mark);
    return group;
  }

  /**
   * Driver en encapsulado SOIC: patas en los dos lados largos.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private soic(part: BoardPart): Group {
    const group = this.chipBody(part.width, part.depth);
    const pins = [0, 2].flatMap((side) => ElectronicParts.pinRow(part, side, ElectronicParts.SOIC_PINS));
    group.add(this.merged(pins, this.tin));
    return group;
  }

  /**
   * Regulador SOT-223: cuerpo, aleta metálica detrás y tres patas al frente.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private sot(part: BoardPart): Group {
    const group = this.chipBody(part.width, part.depth);
    const { tab, pins } = ElectronicParts.SOT;
    const fin = new BoxGeometry(
      part.width * tab,
      ElectronicParts.PIN.height,
      ElectronicParts.PIN.reach,
    ).translate(0, ElectronicParts.PIN.height / 2, -part.depth / 2 - ElectronicParts.PIN.reach / 2);
    const legs = ElectronicParts.pinRow(part, 0, pins);
    group.add(this.merged([fin, ...legs], this.tin));
    return group;
  }

  /**
   * Cristal de cuarzo HC-49 en lata metálica.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private crystal(part: BoardPart): Mesh {
    const { height, radius } = ElectronicParts.CRYSTAL;
    const mesh = new Mesh(new RoundedBoxGeometry(part.width, height, part.depth, 2, radius), this.can);
    mesh.position.y = height / 2;
    return mesh;
  }

  /**
   * Condensador electrolítico: funda azul con franja de polaridad y tapa de aluminio con ranura.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private capacitor(part: BoardPart): Group {
    const { height, stripe, top } = ElectronicParts.CAPACITOR;
    const radius = part.width / 2;
    const group = new Group();
    const body = new Mesh(new CylinderGeometry(radius, radius, height, GeometryDetail.Medium), this.sleeve);
    body.position.y = height / 2;
    const lid = new Mesh(
      new CylinderGeometry(radius * (1 - stripe / 2), radius * (1 - stripe / 2), top, GeometryDetail.Medium),
      this.can,
    );
    lid.position.y = height + top / 2;
    const band = new Mesh(
      new BoxGeometry(radius * stripe * 2, height * (1 - stripe), radius * stripe),
      this.ceramic,
    );
    band.position.set(0, height / 2, radius);
    group.add(body, lid, band);
    return group;
  }

  /**
   * Conector de pines de 2 × 8 (programación SWD): cuerpo de plástico y pines dorados.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private header(part: BoardPart): Group {
    const { height, pin, pinHeight, pitch, columns, rows } = ElectronicParts.HEADER;
    const group = new Group();
    const strip = new Mesh(new BoxGeometry(part.width, height, part.depth), this.epoxy);
    strip.position.y = height / 2;
    const pins = Array.from({ length: columns * rows }, (_pin, index) => {
      const x = (index % columns) * pitch - ((columns - 1) * pitch) / 2;
      const z = (Math.floor(index / columns) - (rows - 1) / 2) * pitch;
      return new BoxGeometry(pin, pinHeight, pin).translate(x, pinHeight / 2, z);
    });
    group.add(strip, this.merged(pins, this.gold));
    return group;
  }

  /**
   * Conector USB-C de chapa.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private usb(part: BoardPart): Mesh {
    const { height, radius } = ElectronicParts.USB;
    const mesh = new Mesh(new RoundedBoxGeometry(part.width, height, part.depth, 2, radius), this.can);
    mesh.position.y = height / 2;
    return mesh;
  }

  /**
   * Bornera de tornillo de dos polos para el motor.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private terminalBlock(part: BoardPart): Group {
    const { height, screw, screws, hole } = ElectronicParts.TERMINAL_BLOCK;
    const group = new Group();
    const block = new Mesh(new BoxGeometry(part.width, height, part.depth), this.terminal);
    block.position.y = height / 2;
    group.add(block);
    const step = part.depth / screws;
    for (let index = 0; index < screws; index += 1) {
      const z = -part.depth / 2 + step * (index + 1 / 2);
      const head = new Mesh(
        new CylinderGeometry(screw, screw, ElectronicParts.PIN.height, GeometryDetail.Medium),
        this.tin,
      );
      head.position.set(0, height, z);
      const opening = new Mesh(new BoxGeometry(ElectronicParts.PIN.height, hole, hole), this.epoxy);
      opening.position.set(part.width / 2, height / 2, z);
      group.add(head, opening);
    }
    return group;
  }

  /**
   * Resistencia o condensador cerámico de montaje superficial con extremos estañados.
   *
   * @param part Componente.
   * @returns Pieza.
   */
  private passive(part: BoardPart): Group {
    const { height } = ElectronicParts.PASSIVE;
    const group = new Group();
    const body = new Mesh(
      new BoxGeometry(part.width, height, part.depth),
      part.x > 0 ? this.ceramic : this.epoxy,
    );
    body.position.y = height / 2;
    group.add(body, this.merged(ElectronicParts.endCaps(part), this.tin));
    return group;
  }

  /**
   * LED de montaje superficial con cuerpo iluminado.
   *
   * @param part Componente.
   * @param material Material iluminado.
   * @returns Pieza.
   */
  private led(part: BoardPart, material: Material): Mesh {
    const height = ElectronicParts.PASSIVE.height;
    const mesh = new Mesh(new BoxGeometry(part.width, height, part.depth), material);
    mesh.position.y = height / 2;
    return mesh;
  }

  /**
   * Punto de prueba: lazo de alambre donde se engancha la sonda.
   *
   * @returns Pieza.
   */
  private testPoint(): Mesh {
    const { radius, tube, height } = ElectronicParts.TEST_POINT;
    const loop = new Mesh(
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Medium),
      this.tin,
    );
    loop.position.y = height - radius;
    return loop;
  }

  /**
   * Cuerpo de epoxi de un chip, apenas separado de la placa.
   *
   * @param width Ancho.
   * @param depth Profundidad.
   * @returns Grupo con el cuerpo.
   */
  private chipBody(width: number, depth: number): Group {
    const { height, lift } = ElectronicParts.CHIP;
    const body = new Mesh(new BoxGeometry(width, height, depth), this.epoxy);
    body.position.y = lift + height / 2;
    const group = new Group();
    group.add(body);
    return group;
  }

  /**
   * Une varias geometrías en una malla y libera las originales.
   *
   * @param pieces Geometrías.
   * @param material Material común.
   * @returns Malla unida.
   */
  private merged(pieces: BufferGeometry[], material: Material): Mesh {
    const mesh = new Mesh(mergeGeometries(pieces), material);
    pieces.forEach((piece) => {
      piece.dispose();
    });
    return mesh;
  }

  /**
   * Extremos estañados de un componente pasivo.
   *
   * @param part Componente pasivo.
   * @returns Geometrías de los dos extremos.
   */
  private static endCaps(part: BoardPart): BufferGeometry[] {
    const { height, cap, capHeight } = ElectronicParts.PASSIVE;
    const alongX = part.width > part.depth;
    const length = alongX ? part.width : part.depth;
    const size = length * cap;
    return [-1, 1].map((side) => {
      const offset = side * (length / 2) * (1 - cap);
      const geometry = alongX
        ? new BoxGeometry(size, height * capHeight, part.depth)
        : new BoxGeometry(part.width, height * capHeight, size);
      return geometry.translate(alongX ? offset : 0, height / 2, alongX ? 0 : offset);
    });
  }

  /**
   * Fila de patas en un lado del chip (0 = frente, 1 = derecha, 2 = atrás, 3 = izquierda).
   *
   * @param part Componente.
   * @param side Lado.
   * @param count Cantidad de patas.
   * @returns Geometrías de las patas.
   */
  private static pinRow(part: BoardPart, side: number, count: number): BufferGeometry[] {
    const { width, height, reach, pitch } = ElectronicParts.PIN;
    const alongX = side % 2 === 0;
    const edge = (alongX ? part.depth : part.width) / 2 + reach / 2;
    const sign = side < 2 ? 1 : -1;
    return Array.from({ length: count }, (_pin, index) => {
      const offset = (index - (count - 1) / 2) * pitch;
      const geometry = alongX ? new BoxGeometry(width, height, reach) : new BoxGeometry(reach, height, width);
      return geometry.translate(alongX ? offset : sign * edge, height / 2, alongX ? sign * edge : offset);
    });
  }
}
