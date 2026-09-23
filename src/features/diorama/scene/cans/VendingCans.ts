import {
  Color,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  type Texture,
  type Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import { CanFlavors } from './CanFlavors';
import { CanLabelArt } from './CanLabelArt';

/**
 * Latas de la vitrina, todas en un solo draw call. Cada lata toma su etiqueta de un atlas en cuadrícula
 * (una celda por sabor/tecnología) mediante un atributo por instancia, con tapas de aluminio aparte.
 * La lata `i` (de izquierda a derecha y de arriba abajo) representa el elemento `i` de la vitrina y lleva
 * su sabor; la elegida sale hacia el vidrio, gira y brilla, y la que está bajo el puntero se adelanta.
 */
export class VendingCans {
  private static readonly CAN = { radius: 0.05, height: 0.17, columns: 5, spacing: 0.155 };
  private static readonly FINISH = {
    label: { roughness: 0.28, metalness: 0.5, envMapIntensity: 0.7 },
    lid: { roughness: 0.25, metalness: 0.9, envMapIntensity: 0.8 },
  };
  private static readonly SHOWCASE = { pull: 0.07, spin: 1.3, rate: 7, brighten: 0.6, hover: 0.45 };
  private static readonly LABEL_ATTRIBUTE = 'canLabel';
  private static readonly FLAVORS = new CanFlavors();

  private readonly placement = new Object3D();
  private readonly tint = new Color();
  private readonly lifts: number[] = [];
  private readonly spins: number[] = [];
  private readonly art: CanLabelArt;
  private readonly count: number;
  private mesh: InstancedMesh | null = null;
  private flavors: readonly string[] = [];
  private selected = -1;
  private hovered = -1;

  /**
   * Crea las latas.
   *
   * @param textures Fábrica de texturas.
   * @param shelves Altura de cada estante, de arriba abajo (en coordenadas de la máquina).
   * @param z Profundidad del centro de las latas.
   */
  public constructor(
    textures: CanvasTextureFactory,
    private readonly shelves: readonly { y: number }[],
    private readonly z: number,
  ) {
    this.art = new CanLabelArt(textures);
    this.count = shelves.length * VendingCans.CAN.columns;
  }

  /**
   * Malla instanciada, para lanzarle el rayo del puntero.
   *
   * @returns Malla o `null` si aún no se construyó.
   */
  public get pickable(): InstancedMesh | null {
    return this.mesh;
  }

  /**
   * Construye la malla instanciada. El cilindro se gira un cuarto de vuelta para que el centro de cada
   * mitad de la etiqueta (donde está el emblema) quede mirando al frente.
   *
   * @param own Registra una textura para liberarla con la máquina.
   * @returns Malla de las latas.
   */
  public build(own: (texture: Texture) => Texture): InstancedMesh {
    const { radius, height } = VendingCans.CAN;
    const geometry = new CylinderGeometry(radius, radius, height, GeometryDetail.High);
    geometry.rotateY(-Math.PI / 2);
    const labels = new Float32Array(this.count);
    geometry.setAttribute(VendingCans.LABEL_ATTRIBUTE, new InstancedBufferAttribute(labels, 1));
    const mesh = new InstancedMesh(geometry, this.materials(own), this.count);
    for (let index = 0; index < this.count; index += 1) {
      this.lifts.push(0);
      this.spins.push(0);
      this.placeCan(index);
      mesh.setMatrixAt(index, this.placement.matrix);
      mesh.setColorAt(index, this.canTint(index));
    }
    this.mesh = mesh;
    this.applyFlavors();
    return mesh;
  }

  /**
   * Fija los elementos de la vitrina: cuántos hay y el sabor de la lata de cada uno.
   *
   * @param flavors Sabor de cada elemento (ids del catálogo), en orden.
   */
  public setItems(flavors: readonly string[]): void {
    this.flavors = flavors;
    this.applyFlavors();
  }

  /**
   * Resalta la lata de un elemento.
   *
   * @param item Índice del elemento.
   */
  public select(item: number): void {
    this.selected = this.canFor(item);
  }

  /**
   * Adelanta un poco la lata de un elemento mientras el puntero está encima.
   *
   * @param item Índice del elemento o `null` para soltarla.
   */
  public hover(item: number | null): void {
    this.hovered = item === null ? -1 : this.canFor(item);
  }

  /**
   * Elemento que representa una lata.
   *
   * @param can Índice de la lata (`instanceId` del impacto).
   * @returns Índice del elemento o `null` si la lata no tiene uno.
   */
  public itemAt(can: number): number | null {
    return can >= 0 && can < Math.min(this.flavors.length, this.count) ? can : null;
  }

  /**
   * Nombre impreso en la lata de un elemento (p. ej. "TypeScript").
   *
   * @param item Índice del elemento.
   * @returns Nombre del sabor.
   */
  public nameOf(item: number): string {
    return VendingCans.FLAVORS.all[this.flavorOf(this.canFor(item))]?.name ?? '';
  }

  /**
   * Base de la lata elegida (adelantada como si ya hubiera salido), para ubicar el aro que la marca.
   *
   * @param target Vector donde se escribe el resultado.
   * @returns `true` si hay una lata elegida.
   */
  public selectedBase(target: Vector3): boolean {
    if (this.selected < 0) {
      return false;
    }
    this.restPosition(this.selected, target);
    target.y -= VendingCans.CAN.height / 2;
    target.z += VendingCans.SHOWCASE.pull;
    return true;
  }

  /**
   * Anima el resalte, el giro y el brillo de cada lata.
   *
   * @param delta Segundos del frame.
   */
  public update(delta: number): void {
    const mesh = this.mesh;
    if (!mesh) {
      return;
    }
    for (let index = 0; index < this.count; index += 1) {
      this.animateCan(index, delta);
      this.placeCan(index);
      mesh.setMatrixAt(index, this.placement.matrix);
      mesh.setColorAt(index, this.canTint(index));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Materiales de la lata: etiqueta (lado, con el atlas) y tapas de aluminio (arriba y abajo).
   *
   * @param own Registra una textura para liberarla con la máquina.
   * @returns Materiales en el orden de los grupos del cilindro.
   */
  private materials(own: (texture: Texture) => Texture): MeshStandardMaterial[] {
    const atlas = own(this.art.atlas(VendingCans.FLAVORS.all));
    const label = new MeshStandardMaterial({ ...VendingCans.FINISH.label, map: atlas });
    label.onBeforeCompile = (shader): void => {
      VendingCans.pickLabelCell(shader);
    };
    const lid = new MeshStandardMaterial({ ...VendingCans.FINISH.lid, map: own(this.art.lid()) });
    return [label, lid, lid];
  }

  /**
   * Escribe en el atributo por instancia la celda del atlas de cada lata.
   */
  private applyFlavors(): void {
    const attribute = this.mesh?.geometry.getAttribute(VendingCans.LABEL_ATTRIBUTE);
    if (!(attribute instanceof InstancedBufferAttribute)) {
      return;
    }
    for (let index = 0; index < this.count; index += 1) {
      attribute.setX(index, this.flavorOf(index));
    }
    attribute.needsUpdate = true;
  }

  /**
   * Sabor de una lata: el de su elemento o, si no tiene (o el id no existe), el del catálogo en su posición.
   *
   * @param can Índice de la lata.
   * @returns Índice del sabor en el catálogo.
   */
  private flavorOf(can: number): number {
    const item = this.itemAt(can);
    const chosen = item === null ? -1 : VendingCans.FLAVORS.indexOf(this.flavors[item] ?? '');
    return chosen >= 0 ? chosen : can % VendingCans.FLAVORS.all.length;
  }

  /**
   * Acerca el resalte de una lata a su objetivo y la hace girar mientras sobresale.
   *
   * @param index Índice de la lata.
   * @param delta Segundos del frame.
   */
  private animateCan(index: number, delta: number): void {
    const { rate, spin } = VendingCans.SHOWCASE;
    const current = this.lifts[index] ?? 0;
    const lift = current + (this.liftGoal(index) - current) * Math.min(delta * rate, 1);
    this.lifts[index] = lift;
    this.spins[index] = (this.spins[index] ?? 0) + delta * spin * lift;
  }

  /**
   * Cuánto debe sobresalir una lata: toda si es la elegida, un poco si el puntero está encima.
   *
   * @param index Índice de la lata.
   * @returns Resalte deseado [0, 1].
   */
  private liftGoal(index: number): number {
    if (index === this.selected) {
      return 1;
    }
    return index === this.hovered ? VendingCans.SHOWCASE.hover : 0;
  }

  /**
   * Brillo de una lata, mayor cuanto más resaltada está (el color lo pone la etiqueta).
   *
   * @param index Índice de la lata.
   * @returns Color (reutilizado).
   */
  private canTint(index: number): Color {
    return this.tint.setScalar(1 + (this.lifts[index] ?? 0) * VendingCans.SHOWCASE.brighten);
  }

  /**
   * Ubica una lata en su estante, adelantada y girada según cuánto esté resaltada.
   *
   * @param index Índice de la lata.
   */
  private placeCan(index: number): void {
    this.restPosition(index, this.placement.position);
    this.placement.position.z += (this.lifts[index] ?? 0) * VendingCans.SHOWCASE.pull;
    this.placement.rotation.y = this.spins[index] ?? 0;
    this.placement.updateMatrix();
  }

  /**
   * Centro de una lata en reposo, en coordenadas de la máquina.
   *
   * @param index Índice de la lata.
   * @param target Vector donde se escribe el resultado.
   */
  private restPosition(index: number, target: Vector3): void {
    const { height, columns, spacing } = VendingCans.CAN;
    const shelf = this.shelves[Math.floor(index / columns)]?.y ?? 0;
    const x = ((index % columns) - (columns - 1) / 2) * spacing;
    target.set(x, shelf + height / 2, this.z);
  }

  /**
   * Lata que representa un elemento: una por elemento, en orden de lectura.
   *
   * @param item Índice del elemento.
   * @returns Índice de la lata.
   */
  private canFor(item: number): number {
    return Math.max(item, 0) % this.count;
  }

  /**
   * Hace que cada instancia lea su celda del atlas: comprime las coordenadas de la etiqueta a la celda de
   * su sabor (la fila 0 del atlas queda arriba en la textura).
   *
   * @param shader Programa del material antes de compilar.
   */
  private static pickLabelCell(shader: WebGLProgramParametersWithUniforms): void {
    const columns = CanLabelArt.COLUMNS.toFixed(1);
    const rows = CanLabelArt.rows(VendingCans.FLAVORS.all.length).toFixed(1);
    const name = VendingCans.LABEL_ATTRIBUTE;
    const remap = [
      `float labelCell = ${name} + 0.5;`,
      `float labelColumn = floor(mod(labelCell, ${columns}));`,
      `float labelRow = floor(labelCell / ${columns});`,
      `vMapUv = vec2((vMapUv.x + labelColumn) / ${columns}, (vMapUv.y + ${rows} - 1.0 - labelRow) / ${rows});`,
    ].join('\n');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float ${name};`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n${remap}`);
  }
}
